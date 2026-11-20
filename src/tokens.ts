/** One piece of a URI as displayed. Concatenating every `text` gives back the URI. */
export interface Token {
  text: string;
  /** The parameter this piece holds, as written (`amount.2`). The path address is `address`. */
  key?: string;
  /** The parameter's value, when the piece is a parameter. */
  value?: string | null;
  mark?: boolean;
}

/**
 * Splits a URI into scheme, path address, separators and `name=value` parameters, without
 * validating anything, so that an error's `param` can be located even in a malformed URI.
 */
export function tokenize(uri: string): Token[] {
  const scheme = /^zcash:/i.exec(uri);
  if (!scheme) return uri ? [{ text: uri }] : [];
  const tokens: Token[] = [{ text: scheme[0] }];
  const rest = uri.slice(scheme[0].length);
  const q = rest.indexOf('?');
  const lead = q === -1 ? rest : rest.slice(0, q);
  if (lead) tokens.push({ text: lead, key: 'address', value: lead });
  if (q === -1) return tokens;
  tokens.push({ text: '?' });
  rest
    .slice(q + 1)
    .split('&')
    .forEach((part, i) => {
      if (i > 0) tokens.push({ text: '&' });
      if (part === '') return;
      const eq = part.indexOf('=');
      tokens.push({
        text: part,
        key: eq === -1 ? part : part.slice(0, eq),
        value: eq === -1 ? null : part.slice(eq + 1),
      });
    });
  return tokens;
}

/** Marks every token holding `param`. Names compare case-insensitively, as the ZIP's ABNF does. */
export function markParam(tokens: readonly Token[], param: string | undefined): Token[] {
  const want = param?.toLowerCase();
  return tokens.map((t) => (want !== undefined && t.key?.toLowerCase() === want ? { ...t, mark: true } : t));
}

/** Splits a parameter key into its name and payment index (`amount.2` → `['amount', 2]`). */
export function splitKey(key: string): [name: string, index: number] {
  const m = /^(.*?)\.([1-9][0-9]{0,3})$/.exec(key);
  return m ? [m[1]!, Number(m[2])] : [key, 0];
}
