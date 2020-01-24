import {LangString} from "./form-model";

/**
 * Represent a SKOS item used in codelists.
 */
export class SkosItem {
  notation: string;
  prefLabel: LangString;

  constructor(notation: string, prefLabel: LangString,) {
    this.notation = notation;
    this.prefLabel = prefLabel;
  }
}

/**
 * Interface of codelist's values.
 */
export interface ValuesSource {

  getAllValues(): SkosItem[];

}

export type ValuesSourceMap = { [iri: string]: ValuesSource };