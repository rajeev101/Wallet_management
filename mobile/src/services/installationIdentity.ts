export interface InstallationIdentity { id: string; credential: string }
export interface MobileLoginDevice extends InstallationIdentity { name: string; platform: 'android' | 'ios'; osVersion: string; appVersion: string }

export function createIdentityStore(storage: { get: () => Promise<string | null>; set: (value: string) => Promise<void> },
  generate: () => Promise<InstallationIdentity>) {
  let pending: Promise<InstallationIdentity> | null = null;
  const load = async () => {
    const saved = await storage.get();
    if (saved !== null) {
      let identity: InstallationIdentity;
      try { identity = JSON.parse(saved); }
      catch { throw new Error('Your device identity could not be read. Please contact admin.'); }
      if (!identity || typeof identity.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identity.id)
        || typeof identity.credential !== 'string' || !/^[0-9a-f]{64}$/.test(identity.credential)) {
        throw new Error('Your device identity could not be read. Please contact admin.');
      }
      return identity;
    }
    const identity = await generate();
    await storage.set(JSON.stringify(identity));
    return identity;
  };
  return () => {
    if (!pending) pending = load().catch(error => { pending = null; throw error; });
    return pending;
  };
}