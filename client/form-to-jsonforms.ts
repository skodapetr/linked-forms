import {
    Field,
    Form,
    LinkedForm, LangString,
} from "./form-model";
import {ValuesSource, SkosItem, ValuesSourceMap} from "./codelist";

export class SchemaEntry {
    type: string;
    properties: { [name: string]: {} } = {};
    required: {}[] = [];

    constructor(type: string) {
        this.type = type;
    }
}

export class UiSchemaEntry {
    type: string;
    elements: {}[] = [];

    constructor(type: string) {
        this.type = type;
    }
}

export class JsonForms {
    schema: {};
    uiSchema: {};

    constructor(schema: {}, uiSchema: {}) {
        this.schema = schema;
        this.uiSchema = uiSchema;
    }
}

/**
 * Used during the conversion to JsonForms.
 */
class Context {
    schema: SchemaEntry;
    uiSchema: UiSchemaEntry;
    getString: { (value: LangString): string };
    propertyPathPrefix: string;
    linkedForm: LinkedForm;
    sources: ValuesSourceMap;

    constructor(
        schema: SchemaEntry,
        uiSchema: UiSchemaEntry,
        linkedForm: LinkedForm,
        getStringFnc: { (value: LangString): string },
        sources: ValuesSourceMap) {
        this.schema = schema;
        this.uiSchema = uiSchema;
        this.linkedForm = linkedForm;
        this.getString = getStringFnc;
        this.propertyPathPrefix = "#/properties/";
        this.sources = sources;
    }

    forNestedForm(
        propName: string, schema: SchemaEntry, uiSchema: UiSchemaEntry,
    ): Context {
        const result = new Context(
              schema, uiSchema, this.linkedForm, this.getString, this.sources);
        result.getString = this.getString;
        result.propertyPathPrefix =
          this.propertyPathPrefix + propName + "/properties/";
        return result;
    }

}

/**
 * Declaration of function type for conversion to JsonForms.
 */
type FieldConverter = {
    (field: Field, propName: string, context: Context): void
};

function getString(value: LangString): string {
    // TODO Add support for languages.
    return value["cs"];
}

export function convert(form: LinkedForm, sources: ValuesSourceMap): JsonForms {
    const schema = createEmptyObjectSchema();
    const uiSchema = createVerticalLayout();
    const context = createDefaultRootContext(form, schema, uiSchema, sources);
    addForm(form.getRootForm(), context);
    return new JsonForms(schema, uiSchema);
}

function createEmptyObjectSchema(): SchemaEntry {
    return new SchemaEntry("object");
}

function createVerticalLayout(): UiSchemaEntry {
    return new UiSchemaEntry("VerticalLayout");
}

function createDefaultRootContext(
    form: LinkedForm, schema: SchemaEntry, uiSchema: UiSchemaEntry,
    sources: ValuesSourceMap) {
    return new Context(schema, uiSchema, form, getString, sources);
}

function addForm(form: Form, context: Context) {
    context.uiSchema.elements.push({
        "type": "Label",
        "text": getString(form.title),
    });
    form.fields.sort((left, right) => left.position - right.position);
    form.fields.forEach((field, index) => {
        const propName = field.property.name;
        addField(field, propName, context);
    });
}

function addField(field: Field, propName: string, context: Context) {
    const form = context.linkedForm.getFormForClass(field.property.range.iri);
    if (form !== null) {
        addFieldForm(field, propName, context, form);
        return;
    }
    let converter = selectConverter(field, context);
    converter(field, propName, context);
}

function addFieldForm(
    field: Field, propName: string, context: Context, form: Form) {
    const schema = createEmptyObjectSchema();
    const uiSchema = createVerticalLayout();
    const newContext = context.forNestedForm(propName, schema, uiSchema);
    addForm(form, newContext);
    // Connect.
    context.schema.properties[propName] = schema;
    context.uiSchema.elements.push(uiSchema);
}

function selectConverter(field: Field, context: Context) : FieldConverter {
    if (field.valuesSource) {
        return addFieldEnum;
    }
    if (field.type.includes(
      "https://linked.opendata.cz/ontology/form/DateField")) {
        return addFieldDate;
    }
    if (field.property.range.iri ===
      "http://www.w3.org/2000/01/rdf-schema#Literal") {
        return addFieldLiteral;
    }
    return addFieldUnsupported;
}

function addFieldEnum(field: Field, propName: string, context: Context) {
    if (field.valuesSource == null) {
        return addError(
          field, "Missing values source definition for enum.", context);
    }
    const source = context.sources[field.valuesSource.iri];
    if (!source) {
        return addError(field, "Missing source for enum.", context);
    }
    context.schema.properties[propName] = {
        "description": context.getString(field.property.title),
        "type": "string",
        "enum": prepareForEnum(source.getAllValues()),
    };
    context.uiSchema.elements.push({
        "type": "Control",
        "scope": context.propertyPathPrefix + propName,
        "label": context.getString(field.title),
    });
}

function addError(field: Field, error: string, context: Context) {
    context.uiSchema.elements.push({
        "type": "Label",
        "text": "Error : " + error,
    });
}

function prepareForEnum(items: SkosItem[]): string[] {
    const result: string[] = [];
    for (const item of items) {
        const label = getString(item.prefLabel);
        if (!result.includes(label)) {
            result.push(label);
        } else {
            console.warn(
              "Ignored duplicity SKOS item:",
              item.notation, item.prefLabel);
        }
    }
    return result;
}

function addFieldDate(field: Field, propName: string, context: Context) {
    context.schema.properties[propName] = {
        "description": context.getString(field.property.title),
        "type": "string",
        "format": "date",
    };
    context.uiSchema.elements.push({
        "type": "Control",
        "scope": context.propertyPathPrefix + propName,
        "label": context.getString(field.title),
    });
}

function addFieldLiteral(field: Field, propName: string, context: Context) {
    context.schema.properties[propName] = {
        "description": context.getString(field.property.title),
        "type": "string",
    };
    context.uiSchema.elements.push({
        "type": "Control",
        "scope": context.propertyPathPrefix + propName,
        "label": context.getString(field.title),
    });
}

function addFieldUnsupported(field: Field, propName: string, context: Context) {
    context.uiSchema.elements.push({
        "type": "Label",
        "text": "Unsupported field: " + field.property.range.iri,
    });
}


// https://jsonforms.io/docs/uischema/controls
// Types:
//  string
//    enum: ["", ""]
//    minLength
//    maxLength
//    format: "date"
//  boolean
//  object
//  integer
//  number
//    maximum, minimum, default