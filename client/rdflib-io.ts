import * as $rdf from "rdflib";
import {unicodeToUTF8} from "./encoding-utils";

export function collectQuadsFromSparqlConstruct(
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

export function fetchStatementsAboutResource(
  iri: string, endpoints: string[]): Promise<$rdf.Store> {
  const query = createDescribeQuery(iri);
  return collectQuadsFromSparqlConstruct(query, endpoints)
    .then((store) => {
      if (store === undefined) {
        throw Error("Store is undefined.");
      }
      return store;
    });
}

function createDescribeQuery(iri: string) {
  return `CONSTRUCT { <${iri}> ?p ?o } WHERE { <${iri}> ?p ?o }`;
}
