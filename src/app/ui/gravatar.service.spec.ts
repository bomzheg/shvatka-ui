import {TestBed} from '@angular/core/testing';
import {GravatarService} from './gravatar.service';

// sha256("test@example.com"), the address trimmed and lowercased
const TEST_HASH = '973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b';

describe('GravatarService', () => {
  let gravatar: GravatarService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    gravatar = TestBed.inject(GravatarService);
  });

  it('has no url without an address', async () => {
    expect(await gravatar.avatarUrl(null, 64)).toBeNull();
    expect(await gravatar.avatarUrl(undefined, 64)).toBeNull();
    expect(await gravatar.avatarUrl('   ', 64)).toBeNull();
  });

  it('keys the avatar by the sha-256 of the normalized address', async () => {
    const url = await gravatar.avatarUrl('test@example.com', 128);

    expect(url).toBe(`https://gravatar.com/avatar/${TEST_HASH}?s=128&d=404`);
  });

  it('normalizes case and surrounding space the way gravatar does', async () => {
    const url = await gravatar.avatarUrl('  Test@Example.COM  ', 128);

    expect(url).toBe(`https://gravatar.com/avatar/${TEST_HASH}?s=128&d=404`);
  });

  it('asks for a 404 rather than a default silhouette', async () => {
    const url = await gravatar.avatarUrl('test@example.com', 64);

    // the caller's own fallback must survive an address with no gravatar
    expect(url).toContain('d=404');
  });

  it('hashes an address once per size', async () => {
    const digest = spyOn(crypto.subtle, 'digest').and.callThrough();

    await gravatar.avatarUrl('test@example.com', 64);
    await gravatar.avatarUrl('TEST@example.com', 64);
    await gravatar.avatarUrl('test@example.com', 128);

    expect(digest).toHaveBeenCalledTimes(2);
  });

  it('gives no url when the context cannot hash', async () => {
    spyOn(crypto.subtle, 'digest').and.rejectWith(new Error('insecure context'));

    expect(await gravatar.avatarUrl('nohash@example.com', 64)).toBeNull();
  });
});
