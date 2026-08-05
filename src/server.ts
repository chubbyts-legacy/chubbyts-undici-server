import type { URL } from 'node:url';
import type {
  RequestInit as UndiciRequestInit,
  BodyInit as UndiciBodyInit,
  ResponseInit as UndiciResponseInit,
} from 'undici';
import { Request as UndiciRequest, Response as UndiciResponse, FormData as UndiciFormData } from 'undici';

type DA = Record<string, unknown>;

export type RequestInfo<A extends DA = DA> = string | URL | UndiciRequest | ServerRequest<A>;

export interface RequestInit<A extends DA = DA, IA extends DA = A> extends UndiciRequestInit {
  attributes?: Readonly<Partial<A> & Partial<Record<keyof NoInfer<IA>, unknown>>>;
}

type MergedAttributes<IA extends DA, A extends DA> = Readonly<Partial<Omit<IA, Extract<keyof A, keyof IA>> & A>>;

const resolveAttributes = <A extends DA, IA extends DA>(
  input: RequestInfo<IA>,
  init?: RequestInit<A, IA>,
): MergedAttributes<IA, A> => {
  const inputAttributes = input instanceof ServerRequest ? input.attributes : {};

  return { ...inputAttributes, ...init?.attributes } as MergedAttributes<IA, A>;
};

export class ServerRequest<A extends DA = DA, IA extends DA = A> extends UndiciRequest {
  readonly attributes: MergedAttributes<IA, A>;
  readonly clone: () => ServerRequest<A, IA>;

  constructor(input: RequestInfo<IA>, init?: RequestInit<A, IA>) {
    super(input, init);

    // oxlint-disable-next-line functional/immutable-data
    this.attributes = resolveAttributes(input, init);

    // oxlint-disable-next-line functional/immutable-data
    this.clone = () => new ServerRequest<A, IA>(this as unknown as ServerRequest<IA>);
  }
}

export class FormData extends UndiciFormData {}

export type BodyInit = UndiciBodyInit;
export type ResponseInit = UndiciResponseInit;

export class Response extends UndiciResponse {}

export type Handler<A extends DA = DA> = (serverRequest: ServerRequest<A>) => Promise<Response>;

export type Middleware<A extends DA = DA> = (request: ServerRequest<A>, handler: Handler<A>) => Promise<Response>;

export const pipe =
  <A extends DA>(middlewares: ReadonlyArray<Middleware<A>>): Middleware<A> =>
  async (request: ServerRequest<A>, handler: Handler<A>) => {
    // oxlint-disable-next-line functional/no-let
    let composed = handler;

    // oxlint-disable-next-line functional/no-let
    for (let i = middlewares.length - 1; i >= 0; i -= 1) {
      const middleware = middlewares[i];
      const next = composed;
      composed = (innerRequest) => middleware(innerRequest, next);
    }

    return composed(request);
  };
