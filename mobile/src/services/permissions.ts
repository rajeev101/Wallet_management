export interface PermissionAccess {
  granted: boolean;
  status: string;
  canAskAgain: boolean;
}

export interface PermissionRequest {
  name: string;
  get: () => Promise<PermissionAccess>;
  request: () => Promise<PermissionAccess>;
}

export async function requestInitialPermissions(permissions: PermissionRequest[]) {
  const unavailable: string[] = [];
  for (const permission of permissions) {
    try {
      const current = await permission.get();
      const result = !current.granted && current.status === 'undetermined' && current.canAskAgain
        ? await permission.request()
        : current;
      if (!result.granted) unavailable.push(permission.name);
    } catch {
      unavailable.push(permission.name);
    }
  }
  return unavailable;
}