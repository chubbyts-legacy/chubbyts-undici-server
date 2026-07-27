import type { URL } from 'node:url';
import type {
  RequestInit as UndiciRequestInit,
  BodyInit as UndiciBodyInit,
  ResponseInit as UndiciResponseInit,
} from 'undici';
import { Request as UndiciRequest, Response as UndiciResponse, FormData as UndiciFormData } from 'undici';

type DA = Record<string, unknown>;

export type RequestInfo<A extends DA = DA> = string | URL | UndiciRequest | ServerRequest<A>;

export interface RequestInit<A extends DA = DA> extends UndiciRequestInit {
  attributes?: Readonly<Partial<A>>;
}

export class ServerRequest<A extends DA = DA> extends UndiciRequest {
  readonly attributes: Readonly<Partial<A>>;
  readonly clone: () => ServerRequest<A>;

  constructor(input: RequestInfo<A>, init?: RequestInit<A>) {
    super(input, init);

    // oxlint-disable-next-line functional/immutable-data
    this.attributes = (
      init?.attributes
        ? { ...init.attributes }
        : input instanceof ServerRequest
          ? ({ ...input.attributes } as Partial<A>)
          : {}
    ) as Readonly<Partial<A>>;

    // oxlint-disable-next-line functional/immutable-data
    this.clone = () => new ServerRequest<A>(this);
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
