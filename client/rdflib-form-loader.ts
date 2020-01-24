import * as $rdf from "rdflib";

import {
    Field,
    Form, LangString,
    LinkedForm, OntologyClass, OntologyProperty, ValuesQuery,Dataset
} from "./form-model";
import {
    collectQuadsFromSparqlConstruct,
    fetchStatementsAboutResource,
} from "./rdflib-io";

let PROP_NAME_COUNTER = 0;

export function loadLinkedForm(iri: string): Promise<LinkedForm> {
    const result = new LinkedForm(iri);
    return loadForm(iri, result)
      .then(() => result);
}

/**
 * Load form of given IRI and save it to given LinkedForm.
 */
function loadForm(iri: string, linkedForm: LinkedForm): Promise<void> {
    const query = createQueryForForm(iri);
    const endpoints = defaultEndpoints();
    return collectQuadsFromSparqlConstruct(query, endpoints)
        .then((store) => {
            if (store === undefined) {
                throw Error("Store is undefined.");
            }
            return loadFormFromStore(iri, linkedForm, store);
        })
        .then(() => {
            const form = linkedForm.forms[iri];
            return resolveFormDependencies(form, linkedForm);
        });
}

function createQueryForForm(iri: string): string {
    return `
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX fo: <https://linked.opendata.cz/ontology/form/>
PREFIX form: <${iri}>

CONSTRUCT {
  form: a ?formType ;
    dct:title ?formTitle ;
    fo:hasTargetClass ?formTargetClass ;
    fo:hasComponent ?component .
  
  ?component a ?componentType ;
    dct:title ?componentTitle ;
    fo:hasTargetProperty ?componentTargetProperty ;
    fo:hasPosition ?componentPosition ;
    fo:hasValuesQuery ?hasValuesQuery .
    
} WHERE {
   form: a ?formType ;
    dct:title ?formTitle ;
    fo:hasTargetClass ?formTargetClass ;
    fo:hasComponent/rdf:rest*/rdf:first ?component .
      
  ?component a ?componentType ;
    dct:title ?componentTitle .
          
  OPTIONAL {
    ?component fo:hasTargetProperty ?componentTargetProperty .
  }

  OPTIONAL {
    ?component fo:hasValuesQuery ?hasValuesQuery .
  }

  {
    SELECT ?component (COUNT(?nextComponent) AS ?reversedPosition)
    WHERE {
      ?component ^rdf:first/rdf:rest*/rdf:first ?nextComponent .
    }
    GROUP BY ?component
  }

  {
    SELECT (COUNT(?component) AS ?componentsCount)
    WHERE {
      form: fo:hasComponent/rdf:rest*/rdf:first ?component .
    }
  }
      
  BIND((?componentsCount - ?reversedPosition) AS ?componentPosition)
}

`;
}

function defaultEndpoints(): string[] {
    return [
        "https://xn--slovnk-7va.gov.cz/sparql",
        "https://csu.opendata.cz/sparql"
    ];
}

async function loadFormFromStore(
    iri: string, linkedForm: LinkedForm, store: $rdf.Store) {
    const resource = $rdf.namedNode(iri);
    const title: LangString = {};
    const fields: Field[] = [];
    let ontologyClass: OntologyClass | null = null;
    for (const quad of store.match(resource)) {
        switch (quad.predicate.value) {
            case "http://purl.org/dc/terms/title":
                if (quad.object instanceof $rdf.Literal) {
                    title[quad.object.language] = quad.object.value;
                }
                break;
            case "https://linked.opendata.cz/ontology/form/hasTargetClass":
                if (quad.object instanceof $rdf.NamedNode) {
                    ontologyClass =
                        await loadOntologyClass(quad.object, linkedForm);
                }
                break;
            case "https://linked.opendata.cz/ontology/form/hasComponent":
                if (quad.object instanceof $rdf.NamedNode ||
                    quad.object instanceof $rdf.BlankNode) {
                    const field =
                        await loadFieldFromStore(quad.object, linkedForm, store);
                    fields.push(field);
                }
                break;
            default:
                break;
        }
    }
    ;
    if (ontologyClass === null) {
        throw new Error("Missing ontology class for: " + iri);
    }
    linkedForm.forms[iri] = new Form(iri, title, fields, ontologyClass);
}

async function loadOntologyClass(
    resource: $rdf.NamedNode, linkedForm: LinkedForm): Promise<OntologyClass> {
    if (linkedForm.ontologyClasses[resource.value]) {
        return linkedForm.ontologyClasses[resource.value];
    }
    const store = await fetchStatementsAboutResource(
      resource.value, defaultEndpoints());
    return loadOntologyClassFromStore(resource, linkedForm, store);
}

function loadOntologyClassFromStore(
    resource: $rdf.NamedNode, linkedForm: LinkedForm,
    store: $rdf.Store): OntologyClass {
    const title: LangString = {};
    const type: string[] = [];
    store.match(resource).forEach(async (quad) => {
        console.log(quad.predicate.value);
        switch (quad.predicate.value) {
            case "http://www.w3.org/1999/02/22-rdf-syntax-ns#type":
                console.log(">", quad.object);
                if (quad.object instanceof $rdf.NamedNode) {
                    type.push(quad.object.value);
                }
                break;
            case "http://purl.org/dc/terms/title":
                if (quad.object instanceof $rdf.Literal) {
                    title[quad.object.language] = quad.object.value;
                }
                break;
            default:
                break;
        }
    });
    const ontologyClass = new OntologyClass(resource.value, title, type);
    linkedForm.ontologyClasses[ontologyClass.iri] = ontologyClass;
    return ontologyClass;
}

async function loadFieldFromStore(
    resource: $rdf.NamedNode | $rdf.BlankNode, linkedForm: LinkedForm,
    store: $rdf.Store): Promise<Field> {
    const title: LangString = {};
    let position: number | null = null;
    let property: OntologyProperty | null = null;
    let valuesSource: ValuesQuery| null = null;
    const type: string[] = [];
    for (const quad of store.match(resource)) {
        switch (quad.predicate.value) {
            case "http://www.w3.org/1999/02/22-rdf-syntax-ns#type":
                if (quad.object instanceof $rdf.NamedNode) {
                    type.push(quad.object.value);
                }
            case "http://purl.org/dc/terms/title":
                if (quad.object instanceof $rdf.Literal) {
                    title[quad.object.language] = quad.object.value;
                }
                break;
            case "https://linked.opendata.cz/ontology/form/hasPosition":
                if (quad.object instanceof $rdf.Literal) {
                    position = parseInt(quad.object.value);
                }
                break;
            case "https://linked.opendata.cz/ontology/form/hasTargetProperty":
                if (quad.object instanceof $rdf.NamedNode) {
                    property = await loadOntologyProperty(
                      quad.object, linkedForm);
                }
                break;
            case "https://linked.opendata.cz/ontology/form/hasValuesQuery":
                if (quad.object instanceof $rdf.NamedNode) {
                    valuesSource = await loadValuesQuerySource(
                      quad.object, linkedForm);
                }
                break;
            default:
                break;
        }
    }
    if (position === null) {
        throw new Error("Missing position for: " + resource.value);
    }
    if (property === null) {
        throw new Error("Missing property: " + resource.value);
    }
    return new Field(
      resource.value, title, position, property, valuesSource, type);
}

async function loadOntologyProperty(
    resource: $rdf.NamedNode, linkedForm: LinkedForm)
  : Promise<OntologyProperty> {
    const store = await fetchStatementsAboutResource(
      resource.value, defaultEndpoints());
    return loadOntologyPropertyFromStore(resource, linkedForm, store);
}

async function loadOntologyPropertyFromStore(
    resource: $rdf.NamedNode | $rdf.BlankNode,
    linkedForm: LinkedForm, store: $rdf.Store): Promise<OntologyProperty> {
    let domain: OntologyClass | null = null;
    let range: OntologyClass | null = null;
    const title: LangString = {};
    for (const quad of store.match(resource)) {
        switch (quad.predicate.value) {
            case "http://purl.org/dc/terms/title":
                if (quad.object instanceof $rdf.Literal) {
                    title[quad.object.language] = quad.object.value;
                }
                break;
            case "http://www.w3.org/2000/01/rdf-schema#domain":
                if (quad.object instanceof $rdf.NamedNode) {
                    domain = await loadOntologyClass(quad.object, linkedForm);
                }
                break;
            case "http://www.w3.org/2000/01/rdf-schema#range":
                if (quad.object instanceof $rdf.NamedNode) {
                    range = await loadOntologyClass(quad.object, linkedForm);
                }
                break;
            default:
                break;
        }
    }
    if (domain === null) {
        throw new Error("Missing domain for: " + resource.value);
    }
    if (range === null) {
        throw new Error("Missing range for: " + resource.value);
    }
    return new OntologyProperty(
        resource.value, domain, range, title, createNextPropName());
}

function createNextPropName(): string {
    return "prop_" + zeroFill(++PROP_NAME_COUNTER, 6);
}

function zeroFill(value: number, size: number) {
    const sign = Math.sign(value) === -1 ? "-" : "";
    const valueAsStr =
        new Array(size).concat([Math.abs(value)]).join("0").slice(-size);
    return sign + valueAsStr;
}

async function loadValuesQuerySource(
  resource: $rdf.NamedNode, linkedForm: LinkedForm)
  : Promise<ValuesQuery> {
    if (linkedForm.valuesSources[resource.value]) {
        return linkedForm.valuesSources[resource.value];
    }

    const store = await fetchStatementsAboutResource(
      resource.value, defaultEndpoints());
    return loadValuesQuerySourceFromStore(resource, linkedForm, store);
}

async function loadValuesQuerySourceFromStore(
  resource: $rdf.NamedNode | $rdf.BlankNode,
  linkedForm: LinkedForm, store: $rdf.Store): Promise<ValuesQuery> {

    let dataset: Dataset | null = null;
    let query: string | null = null;
    const title: LangString = {};

    for (const quad of store.match(resource)) {
        switch (quad.predicate.value) {
            case "http://purl.org/dc/terms/title":
                if (quad.object instanceof $rdf.Literal) {
                    title[quad.object.language] = quad.object.value;
                }
                break;
            case "https://linked.opendata.cz/ontology/form/hasDataset":
                if (quad.object instanceof $rdf.NamedNode) {
                    dataset = await loadDataset(quad.object, linkedForm);
                }
                break;
            case "https://linked.opendata.cz/ontology/form/query":
                if (quad.object instanceof $rdf.Literal) {
                    query = quad.object.value;
                }
                break;
        }
    }
    if (dataset === null) {
        throw new Error("Missing dataset for: " + resource.value);
    }
    if (query === null) {
        throw new Error("Missing query for: " + resource.value);
    }

    const valuesQuerySource = new ValuesQuery(
      resource.value, title, dataset, query);
    linkedForm.valuesSources[resource.value] = valuesQuerySource;
    return valuesQuerySource;
}

async function loadDataset(
  resource: $rdf.NamedNode, linkedForm: LinkedForm)
  : Promise<Dataset> {
    if (linkedForm.datasets[resource.value]) {
        return linkedForm.datasets[resource.value];
    }

    const store = await fetchStatementsAboutResource(
      resource.value, defaultEndpoints());
    return loadDatasetFromStore(resource, linkedForm, store);
}

async function loadDatasetFromStore(
  resource: $rdf.NamedNode | $rdf.BlankNode,
  linkedForm: LinkedForm, store: $rdf.Store): Promise<Dataset> {

    let endpoint: string | null = null;
    const title: LangString = {};

    for (const quad of store.match(resource)) {
        switch (quad.predicate.value) {
            case "http://purl.org/dc/terms/title":
                if (quad.object instanceof $rdf.Literal) {
                    title[quad.object.language] = quad.object.value;
                }
                break;
            case "http://rdfs.org/ns/void#sparqlEndpoint":
                if (quad.object instanceof $rdf.NamedNode) {
                    endpoint = quad.object.value;
                }
                break;
        }
    }
    if (endpoint === null) {
        throw new Error("Missing endpoint for: " + resource.value);
    }

    const dataset = new Dataset(
      resource.value, title, endpoint);
    linkedForm.datasets[resource.value] = dataset;
    return dataset;
}

/**
 * Add form for complex classes.
 */
async function resolveFormDependencies(
    form: Form, linkedForm: LinkedForm
): Promise<void> {
    const missingRanges = collectUnknownRangeClasses(form, linkedForm);
    for (const classIri of missingRanges) {
        const classIriNode: $rdf.NamedNode = new $rdf.NamedNode(classIri);
        const ontologyClass = await loadOntologyClass(classIriNode, linkedForm);
        const candidateDialogs = await collectFormsForClass(ontologyClass);
        for (const formIri of candidateDialogs) {
            await loadForm(formIri, linkedForm);
        }
    }
}

function collectUnknownRangeClasses(form: Form, linkedForm: LinkedForm)
  : string[] {
    const missingRanges: string[] = [];
    form.fields.forEach((field) => {
        const rangeIri = field.property.range.iri;
        if (missingRanges.includes(rangeIri)) {
            return;
        }
        if (linkedForm.getFormForClass(rangeIri) !== null) {
            return;
        }
        missingRanges.push(rangeIri);
    });
    return missingRanges;
}

function collectFormsForClass(ontologyClass: OntologyClass)
    : Promise<string[]> {
    const query = createQueryForFormsForClass(ontologyClass.iri);
    const endpoints = defaultEndpoints();
    return collectQuadsFromSparqlConstruct(query, endpoints)
        .then((store) => {
            if (store === undefined) {
                throw Error("Store is undefined.");
            }
            const result: string[] = [];
            const formType: $rdf.NamedNode = new $rdf.NamedNode(
              "https://linked.opendata.cz/ontology/form/Form");
            for (const quad of store.match(null, null, formType)) {
                if (!result.includes(quad.subject.value)) {
                    result.push(quad.subject.value);
                }
            }
            return result;
        });
}

function createQueryForFormsForClass(iri: string): string {
    return `
PREFIX fo: <https://linked.opendata.cz/ontology/form/>
PREFIX formTargetClass: <${iri}>

CONSTRUCT {
  ?form a ?formType .
} WHERE {
  ?form a ?formType ;
    fo:hasTargetClass formTargetClass: .
}

`;
}
