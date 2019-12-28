export type LangString = { [language: string]: string; };

export class OntologyClass {
    iri: string;
    prefLabel: LangString;

    constructor(iri: string, prefLabel: LangString,) {
        this.iri = iri;
        this.prefLabel = prefLabel;
    }
}

export class OntologyProperty {
    iri: string;
    domain: OntologyClass;
    /**
     * Can referer to a simple property as rdfs:Literal or
     * target class of a dialog.
     */
    range: string;
    prefLabel: LangString;
    /**
     * Name used to represent this property in application,
     * must be unique. Is not loaded from the data.
     */
    name: string;

    constructor(
        iri: string,
        domain: OntologyClass,
        range: string,
        prefLabel: LangString,
        name: string,
    ) {
        this.iri = iri;
        this.domain = domain;
        this.range = range;
        this.prefLabel = prefLabel;
        this.name = name;
    }
}

export class Field {
    iri: string;
    title: LangString;
    position: number;
    property: OntologyProperty;

    constructor(
        iri: string,
        title: LangString,
        position: number,
        property: OntologyProperty,
    ) {
        this.iri = iri;
        this.title = title;
        this.position = position;
        this.property = property;
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
    ontologyClasses: { [iri: string]: OntologyClass } = {};

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
    const form = linkedForm.getFormForClass(field.property.range);
    if (form !== null) {
        return createNewValueForForm(linkedForm, form);
    } else {
        // TODO Get default values somewhere.
        return "";
    }
}
