import {HttpErrorResponse} from '@angular/common/http';

import {isSafeDocUrl, readApiError, readDocUrl} from './api-error';

const DOC_URL = 'https://docs.example.org/shvatka/3.7.0/player/play.html#keys';

function response(body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({status: 422, error: body, url: '/games/1/keys'});
}

describe('api-error', () => {
  it('reads the backend error body', () => {
    const error = readApiError(response({
      type: 'InvalidKey',
      text: 'wrong key',
      description: 'Это не ключ',
      docUrl: DOC_URL,
    }));
    expect(error).toEqual({
      type: 'InvalidKey',
      text: 'wrong key',
      description: 'Это не ключ',
      docUrl: DOC_URL,
    });
  });

  it('reads an error the backend gave no doc page', () => {
    const error = readApiError(response({type: 'SHError', description: 'Ошибка'}));
    expect(error?.docUrl).toBeNull();
    expect(error?.description).toBe('Ошибка');
    expect(error?.text).toBe('');
  });

  it('has nothing to read in a non-object body', () => {
    expect(readApiError(response('gateway is down'))).toBeNull();
    expect(readApiError(response(null))).toBeNull();
    expect(readApiError('not a response at all')).toBeNull();
  });

  it('drops a doc url that is not http', () => {
    expect(readDocUrl('javascript:alert(1)')).toBeNull();
    expect(readDocUrl(42)).toBeNull();
    expect(readDocUrl('')).toBeNull();
    expect(readDocUrl(DOC_URL)).toBe(DOC_URL);
  });

  it('knows which urls are safe to open', () => {
    expect(isSafeDocUrl(DOC_URL)).toBeTrue();
    expect(isSafeDocUrl('http://docs.example.org/page.html')).toBeTrue();
    expect(isSafeDocUrl('/docs/page.html')).toBeTrue();
    expect(isSafeDocUrl('javascript:alert(1)')).toBeFalse();
    expect(isSafeDocUrl(null)).toBeFalse();
    expect(isSafeDocUrl(undefined)).toBeFalse();
  });
});
