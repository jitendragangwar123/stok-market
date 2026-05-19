export type Category =
  | "Crypto"
  | "Politics"
  | "Sports"
  | "Tech"
  | "Economy"
  | "Pop Culture"
  | "World"
  | "Other";


export const CATEGORIES: Category[] = [
  "Crypto",
  "Politics",
  "Sports",
  "Tech",
  "Economy",
  "Pop Culture",
  "World",
  "Other",
];

const RULES: Record<Exclude<Category, "Other">, RegExp[]> = {
  Crypto: [
    /\b(btc|bitcoin|eth|ethereum|sol|solana|xrp|doge|crypto|defi|nft|stablecoin|usdc|usdt|dai|coinbase|binance|onchain)\b/i,
    /\$\d/, // "$BTC", "$100k" style price mentions
  ],
  Politics: [
    /\b(election|trump|biden|harris|president|senate|congress|vote|gop|democrat|republican|tariff|impeach|prime minister|parliament|cabinet|primary)\b/i,
  ],
  Sports: [
    /\b(nfl|nba|steps|sportstech|mlb|nhl|fifa|football|basketball|baseball|hockey|soccer|world cup|champions league|finals|playoff|super bowl|olympics|lakers|warriors|patriots|chiefs|celtics)\b/i,
  ],
  Tech: [
    /\b(ai|agi|gpt|openai|anthropic|claude|llm|tesla|spacex|apple|google|microsoft|meta|nvidia|chip|gpu|model|launch|release|ios|android)\b/i,
  ],
  Economy: [
    /\b(fed|federal reserve|interest rate|inflation|cpi|gdp|recession|unemployment|jobs report|s&p|nasdaq|dow|treasury|bond|currency|euro|yen|oil price|housing|mortgage)\b/i,
  ],
  "Pop Culture": [
    /\b(taylor swift|oscar|grammy|emmy|movie|netflix|disney|hbo|spotify|album|concert|tour|box office|season|reality tv|kardashian|celebrity|streaming)\b/i,
  ],
  World: [
    /\b(russia|ukraine|israel|gaza|china|taiwan|north korea|south korea|iran|saudi|nato|brexit|geopolitic|war|treaty|sanction|summit|hostage|ceasefire|coup)\b/i,
  ],
};

export function categorize(question: string): Category {
  for (const cat of CATEGORIES) {
    if (cat === "Other") continue;
    const patterns = RULES[cat];
    if (patterns.some((p) => p.test(question))) return cat;
  }
  return "Other";
}

/** Type guard for URL params / external input. */
export function isCategory(value: string | null | undefined): value is Category {
  return !!value && (CATEGORIES as readonly string[]).includes(value);
}
