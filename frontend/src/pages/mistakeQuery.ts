export interface MistakeQueryInput {
  page: number;
  pageSize: number;
  errorType: string;
  predictDirection: string;
  gameNumberKeyword: string;
}

export interface MistakeQueryParams {
  page: number;
  pageSize: number;
  errorType?: string;
  predictDirection?: string;
  gameNumberKeyword?: string;
}

export const buildMistakeQueryParams = (input: MistakeQueryInput): MistakeQueryParams => {
  const gameNumberKeyword = input.gameNumberKeyword.trim();
  return {
    page: input.page,
    pageSize: input.pageSize,
    ...(input.errorType ? { errorType: input.errorType } : {}),
    ...(input.predictDirection ? { predictDirection: input.predictDirection } : {}),
    ...(gameNumberKeyword ? { gameNumberKeyword } : {}),
  };
};
