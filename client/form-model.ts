export type LangString = { [language: string]: string; };

export class Dataset {
    iri: string;
    title: LangString;
    endpoint: string;

    constructor(iri: string, title:LangString, endpoint: string) {
        this.iri = iri;
        this.title = title;
        this.endpoint = endpoint;
    }

}

/**
 * Represent a source of a SKOS codelist in form of a SPARQL query.
 */
export class ValuesQuery {
    iri: string;
    title: LangString;
    dataset: Dataset;
    query: string;

    constructor(
      iri: string, title: LangString, dataset: Dataset, query:string,) {
        this.iri = iri;
        this.title = title;
        this.dataset = dataset;
        this.query = query;
    }

}

export class OntologyClass {
    iri: string;
    title: LangString;
    type: string[];

    constructor(iri: string, title: LangString,type: string[],) {
        this.iri = iri;
        this.title = title;
        this.type = type;
    }
}

export class OntologyProperty {
    iri: string;
    domain: OntologyClass;
    /**
     * Can referer to a simple property as rdfs:Literal or
     * target class of a dialog.
     */
    range: OntologyClass;
    title: LangString;
    /**
     * Name used to represent this property in application,
     * must be unique. Is not loaded from the data.
     */
    name: string;

    constructor(
        iri: string,
        domain: OntologyClass,
        range: OntologyClass,
        title: LangString,
        name: string,
    ) {
        this.iri = iri;
        this.domain = domain;
        this.range = range;
        this.title = title;
        this.name = name;
    }
}

export class Field {
    iri: string;
    title: LangString;
    position: number;
    property: OntologyProperty;
    valuesSource: ValuesQuery | null;
    type: string[];

    constructor(
        iri: string,
        title: LangString,
        position: number,
        property: OntologyProperty,
        valuesSource: ValuesQuery | null,
        type: string[],
    ) {
        this.iri = iri;
        this.title = title;
        this.position = position;
        this.property = property;
        this.valuesSource = valuesSource;
        this.type = type;
    }
}

/**
 * An instance of a single form.
 */
export class Form {
    iri: string;
    title: LangString;
    fields: Field[];
    targetClass: OntologyClass;

    constructor(
        iri: string,
        title: LangString,
        fields: Field[],
        targetClass: OntologyClass,
    ) {
        this.iri = iri;
        this.title = title;
        this.fields = fields;
        this.targetClass = targetClass;
    }

}

/**
 * All information needed to create a dialog.
 */
export class LinkedForm {
    /**
     * IRI of the main form.
     */
    iri: string;
    forms: { [iri: string]: Form } = {};

    // Maps bellow are used to directly access objects of certain types.

    ontologyClasses: { [iri: string]: OntologyClass } = {};
    valuesSources: { [iri:string]: ValuesQuery} = {};
    datasets: { [iri:string]: Dataset} = {};

    constructor(iri: string) {
        this.iri = iri;
    }

    /**
     * Return root (top) level form.
     */
    getRootForm(): Form {
        return this.forms[this.iri];
    }

    getFormForClass(iri: string): Form | null {
        for (let key in this.forms) {
            if (!this.forms.hasOwnProperty(key)) {
                continue;
            }
            const form = this.forms[key];
            if (form.targetClass.iri === iri) {
                return form;
            }
        }
        return null;
    }

}

export function createNewValue(linkedForm: LinkedForm): {} {
    const rootForm = linkedForm.getRootForm();
    return createNewValueForForm(linkedForm, rootForm);
}

function createNewValueForForm(linkedForm: LinkedForm, form: Form): {} {
    const result: { [key: string]: any } = {};
    form.fields.forEach((field) => {
        result[field.property.name] =
            createNewValueForField(linkedForm, field);
    });
    return result;
}

function createNewValueForField(linkedForm: LinkedForm, field: Field): any {
    const form = linkedForm.getFormForClass(field.property.range.iri);
    if (form !== null) {
        return createNewValueForForm(linkedForm, form);
    } else {
        // TODO Get default values somewhere.
        return "";
    }
}
