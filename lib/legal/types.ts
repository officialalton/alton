export type LegalBlock =
  | { readonly t: "p"; readonly text: string }
  | { readonly t: "h3"; readonly text: string }
  | { readonly t: "ul"; readonly items: readonly string[] };

export type LegalSectionData = {
  readonly heading: string | null;
  readonly blocks: readonly LegalBlock[];
};

export type LegalDocumentData = {
  readonly title: string;
  readonly versionLine: string | null;
  readonly sections: readonly LegalSectionData[];
};
