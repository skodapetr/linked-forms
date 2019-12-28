import * as $rdf from "rdflib";
import {
    Field,
    Form, LangString,
    LinkedForm, OntologyClass, OntologyProperty,
} from "./form-model";
import {unicodeToUTF8} from "./encoding-utils";

// https://etl.opendata.cz/#/pipelines/edit/canvas?pipeline=https:%2F%2Fetl.opendata.cz%2Fresources%2Fpipelines%2F1575894679479

let PROP_NAME_COUNTER = 0;

export function loadLinkedForm(iri: string): Promise<LinkedForm> {
    const result = new LinkedForm(iri);
    return loadForm(iri, result).then(() => result);
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
    fo:hasPosition ?componentPosition .
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

  {
    SELECT ?component (COUNT(?nextComponent) AS ?reversedPosition)
    WHERE {
      ?component ^rdf:first/rdf:rest+/rdf:first ?nextComponent .
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

function collectQuadsFromSparqlConstruct(
    query: string, endpoints: string[],
    store?: $rdf.Store, fetcher?: $rdf.Fetcher
): Promise<$rdf.Store | undefined> {
    store = store || createStore();
    // Declaration of _fetcher is workaround to trick TypeScript.
    const _fetcher = fetcher || createFetcher(store);
    return Promise.all(
        endpoints
            .map((endpoint) => asVirtuoso(query, endpoint))
            .map((url) => addToStoreFromUrl(url, _fetcher))
    ).then(() => {
        return store;
    });
}

function createStore(): $rdf.Store {
    const store = $rdf.graph(undefined, undefined);
    const oldAdd = store.add.bind(store);
    store.add = (subj, pred, obj, why) => {
        if (subj instanceof $rdf.NamedNode) {
            subj.value = unicodeToUTF8(subj.value);
        }
        if (pred instanceof $rdf.NamedNode) {
            pred.value = unicodeToUTF8(pred.value);
        }
        if (obj instanceof $rdf.NamedNode) {
            obj.value = unicodeToUTF8(obj.value);
        }
        if (why instanceof $rdf.NamedNode) {
            why.value = unicodeToUTF8(why.value);
        }
        return oldAdd(subj, pred, obj, why);
    };
    return store;
}

function createFetcher(store: $rdf.IndexedFormula): $rdf.Fetcher {

    /**
     * For some reason direct use of headers leads to
     * accept header to not be used.
     */
    const fetchFunction = (uri: any, options: any): Promise<Response> => {
        let headers = new Headers;
        if (options.headers && options.headers["accept"]) {
            headers.append("accept", options.headers["accept"]);
        }
        options.headers = headers;
        return fetch(uri, options);
    };

    const fetcher = new $rdf.Fetcher(store, {
        "fetch": fetchFunction,
    });

    // By default all is enabled, that cause Accept header to be too
    // long and not pass CORS restrictions.
    fetcher.mediatypes = {
        "text/turtle": {"q": 0.95},
    };
    return fetcher;
}

function asVirtuoso(query: string, endpoint: string): string {
    const format = "text/turtle";
    return endpoint + "?query=" + encodeURIComponent(query)
        + "&format=" + encodeURIComponent(format);
}

function addToStoreFromUrl(
    url: string, fetcher: $rdf.Fetcher): Promise<Response[]> {
    /**
     * Disable use of CORS and metadata, we just want a clear RDF
     * inside our store.
     */
    const loadOptions = {
        "credentials": "omit" as const,
        "withCredentials": false,
        "noMeta": true,
    };
    return Promise.all(asArray(fetcher.load(url, loadOptions)));
}

function asArray<T>(value: T | T[]): T[] {
    if (Array.isArray(value)) {
        return value;
    } else {
        return [value];
    }
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
    resource: $rdf.NamedNode, linkedForm: LinkedForm
): Promise<OntologyClass> {
    if (linkedForm.ontologyClasses[resource.value]) {
        return linkedForm.ontologyClasses[resource.value];
    }
    const store = await fetchStatementsAboutResource(resource.value);
    return loadOntologyClassFromStore(resource, linkedForm, store);
}

function fetchStatementsAboutResource(iri: string): Promise<$rdf.Store> {
    const query = createDescribeQuery(iri);
    const endpoints = defaultEndpoints();
    return collectQuadsFromSparqlConstruct(query, endpoints)
        .then((store) => {
            if (store === undefined) {
                throw Error("Store is undefined.");
            }
            return store;
        });
}

function createDescribeQuery(iri: string) {
    return `
CONSTRUCT { <${iri}> ?p ?o } WHERE { <${iri}> ?p ?o } 
`
}

function loadOntologyClassFromStore(
    resource: $rdf.NamedNode, linkedForm: LinkedForm,
    store: $rdf.Store): OntologyClass {
    const prefLabel: LangString = {};
    store.match(resource).forEach(async (quad) => {
        switch (quad.predicate.value) {
            case "http://www.w3.org/2004/02/skos/core#prefLabel":
                if (quad.object instanceof $rdf.Literal) {
                    prefLabel[quad.object.language] = quad.object.value;
                }
                break;
            default:
                break;
        }
    });
    const ontologyClass = new OntologyClass(resource.value, prefLabel);
    linkedForm.ontologyClasses[ontologyClass.iri] = ontologyClass;
    return ontologyClass;
}

async function loadFieldFromStore(
    resource: $rdf.NamedNode | $rdf.BlankNode, linkedForm: LinkedForm,
    store: $rdf.Store): Promise<Field> {
    const title: LangString = {};
    let position: number | null = null;
    let property: OntologyProperty | null = null;
    for (const quad of store.match(resource)) {
        switch (quad.predicate.value) {
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
                    property = await loadOntologyProperty(quad.object, linkedForm);
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
    return new Field(resource.value, title, position, property);
}

async function loadOntologyProperty(
    resource: $rdf.NamedNode | $rdf.BlankNode, linkedForm: LinkedForm
): Promise<OntologyProperty> {
    const store = await fetchStatementsAboutResource(resource.value);
    return loadOntologyPropertyFromStore(resource, linkedForm, store);
}

async function loadOntologyPropertyFromStore(
    resource: $rdf.NamedNode | $rdf.BlankNode,
    linkedForm: LinkedForm, store: $rdf.Store): Promise<OntologyProperty> {
    let domain: OntologyClass | null = null;
    let range: string | null = null;
    const prefLabel: LangString = {};
    for (const quad of store.match(resource)) {
        switch (quad.predicate.value) {
            case "http://www.w3.org/2004/02/skos/core#prefLabel":
                if (quad.object instanceof $rdf.Literal) {
                    prefLabel[quad.object.language] = quad.object.value;
                }
                break;
            case "http://www.w3.org/2000/01/rdf-schema#domain":
                if (quad.object instanceof $rdf.NamedNode) {
                    domain = await loadOntologyClass(quad.object, linkedForm);
                }
                break;
            case "http://www.w3.org/2000/01/rdf-schema#range":
                if (quad.object instanceof $rdf.NamedNode) {
                    range = quad.object.value;
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
        resource.value, domain, range, prefLabel, createNextPropName());
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

/**
 * Add form for complex classes.
 */
async function resolveFormDependencies(
    form: Form, linkedForm: LinkedForm
): Promise<void> {
    const missingRanges = collectUnknownRangeClasses(form, linkedForm);
    for (const iri of missingRanges) {
        const resource: $rdf.NamedNode = new $rdf.NamedNode(iri);
        const ontologyClass = await loadOntologyClass(resource, linkedForm);
        const candidateDialogs = await collectFormsForClass(ontologyClass);
        console.log("Dialogs for: ", iri, " are ", candidateDialogs);
    }
}

function collectUnknownRangeClasses(form: Form, linkedForm: LinkedForm): string[] {
    const knownRanges: string[] = getKnownRanges();
    const missingRanges: string[] = [];
    form.fields.forEach((field) => {
        const range = field.property.range;
        if (knownRanges.includes(range)) {
            return;
        }
        if (missingRanges.includes(range)) {
            return;
        }
        if (linkedForm.getFormForClass(range) !== null) {
            return;
        }
        missingRanges.push(range);
    });
    return missingRanges;
}

/**
 * Collections of classes that we can represent using basic
 * components and are not needed to be resolved.
 */
function getKnownRanges(): string[] {
    return [
        "http://www.w3.org/2000/01/rdf-schema#Literal"
    ];
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
            for (const quad of store.match()) {
                if (result.includes(quad.subject.value)) {
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




