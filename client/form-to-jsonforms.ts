import {
    Field,
    Form,
    LinkedForm, LangString,
} from "./form-model";
import shadows from "@material-ui/core/styles/shadows";

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
 * Declaration of function type for conversion to JsonForms.
 */
type FieldConverter = {
    (field: Field, propName: string, context: Context): void
};

/**
 * Used when no converter can be used for given data range.
 */
const DEFAULT_CONVERTER_IRI = "http://localhost/default";

/**
 * Used during the conversion to JsonForms.
 */
class Context {
    schema: SchemaEntry;
    uiSchema: UiSchemaEntry;
    getString: { (value: LangString): string };
    fieldConnectors: { [iri: string]: FieldConverter };
    propertyPathPrefix: string;
    linkedForm: LinkedForm;

    constructor(
        schema: SchemaEntry,
        uiSchema: UiSchemaEntry,
        linkedForm: LinkedForm,
        getStringFnc: { (value: LangString): string }) {
        this.schema = schema;
        this.uiSchema = uiSchema;
        this.linkedForm = linkedForm;
        this.getString = getStringFnc;
        this.fieldConnectors = {};
        this.propertyPathPrefix = "#/properties/";
    }

    forNestedForm(
        propName: string, schema: SchemaEntry, uiSchema: UiSchemaEntry
    ): Context {
        const result =
            new Context(schema, uiSchema, this.linkedForm, this.getString);
        result.getString = this.getString;
        result.fieldConnectors = this.fieldConnectors;
        result.propertyPathPrefix = this.propertyPathPrefix + propName + "/properties/";
        return result;
    }

}

function getString(value: LangString): string {
    // TODO Add support for languages.
    return value["cs"];
}

export function convert(form: LinkedForm): JsonForms {
    const schema = createEmptyObjectSchema();
    const uiSchema = createVerticalLayout();
    const context = createDefaultRootContext(form, schema, uiSchema);
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
    form: LinkedForm, schema: SchemaEntry, uiSchema: UiSchemaEntry) {
    const context = new Context(schema, uiSchema, form, getString);
    context.fieldConnectors[DEFAULT_CONVERTER_IRI] = addFieldDefault;
    context.fieldConnectors["http://www.w3.org/2000/01/rdf-schema#Literal"] =
        addFieldLiteral;
    return context;
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
    const form = context.linkedForm.getFormForClass(field.property.range);
    if (form !== null) {
        addFieldForm(field, propName, context, form);
        return;
    }
    let converter = context.fieldConnectors[field.property.range];
    if (!converter) {
        converter = context.fieldConnectors[DEFAULT_CONVERTER_IRI];
    }
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

function addFieldDefault(field: Field, propName: string, context: Context) {
    context.uiSchema.elements.push({
        "type": "Label",
        "text": "Unsupported field: " + field.property.range,
    });
}

function addFieldLiteral(field: Field, propName: string, context: Context) {
    context.schema.properties[propName] = {
        "description": context.getString(field.property.prefLabel),
        "type": "string",
    };
    context.uiSchema.elements.push({
        "type": "Control",
        "scope": context.propertyPathPrefix + propName,
        "label": context.getString(field.title),
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