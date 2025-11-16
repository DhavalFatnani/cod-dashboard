export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  error_code?: string;
};

export function toProblem(
  status: number,
  title: string,
  detail?: string,
  extras?: Partial<ProblemDetails>
): ProblemDetails {
  return {
    type: `about:blank`,
    title,
    status,
    detail,
    ...extras,
  };
}
