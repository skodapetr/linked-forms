import * as $rdf from "rdflib";

import {LangString, LinkedForm, ValuesQuery,} from "./form-model";
import {SkosItem, ValuesSource, ValuesSourceMap,} from "./codelist";
import {collectQuadsFromSparqlConstruct} from "./rdflib-io";

/**
 * Pre-fetch all the values.
 */
class SparqlValuesSource implements ValuesSource {
  loaded: boolean = false;
  values: SkosItem[] = [];
  source: ValuesQuery;

  constructor(source:ValuesQuery,) {
    this.source = source;
  }

  getAllValues(): SkosItem[] {
    return this.values;
  }

  /**
   * Eager loads all the data.
   */
  async fetchAll(): Promise<void> {
    const store = await collectQuadsFromSparqlConstruct(
      this.source.query, [this.source.dataset.endpoint]);
    if (!store) {
      throw Error("Can't query endpoint.");
    }
    console.log("Loading for: ", this.source.iri);
    const type = new $rdf.NamedNode(
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
    const Concept = new $rdf.NamedNode(
      "http://www.w3.org/2004/02/skos/core#Concept");
    const result: SkosItem[] = [];
    for (const quad of store.match(null, type, Concept)) {
      if (quad.subject instanceof $rdf.NamedNode
        || quad.subject instanceof $rdf.BlankNode) {
        result.push(loadSkosItem(quad.subject, store));
      }
    }
    this.values = result;
  }

}

function loadSkosItem(
  resource: $rdf.NamedNode | $rdf.BlankNode, store: $rdf.IndexedFormula) : SkosItem  {
  let notation: string | null = null;
  const prefLabel: LangString = {};

  for (const quad of store.match(resource)) {
    switch (quad.predicate.value) {
      case "http://www.w3.org/2004/02/skos/core#prefLabel":
        if (quad.object instanceof $rdf.Literal) {
          prefLabel[quad.object.language] = quad.object.value;
        }
        break;
      case "http://www.w3.org/2004/02/skos/core#notation":
        if (quad.object instanceof $rdf.Literal) {
          notation = quad.object.value;
        }
        break;
    }
  }

  if (notation === null) {
    throw new Error("Missing notation for: " + resource.value);
  }
  return new SkosItem(notation, prefLabel);
}

export async function loadValuesSources(
  linkedForm: LinkedForm): Promise<ValuesSourceMap> {
  const result: ValuesSourceMap = {};
  for (const source of Object.values(linkedForm.valuesSources)) {
    result[source.iri] = await loadValuesQuerySource(source);
  }
  return result;
}

async function loadValuesQuerySource(
  source: ValuesQuery) : Promise<ValuesSource> {
  const result = new SparqlValuesSource(source);
  await result.fetchAll();
  return result;
}

