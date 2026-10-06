import { DRIVE_API, driveFetch } from "./fetch";
import { personFolderName, type ArchiveKind } from "./archive-config";

type DriveFile = { id: string; name: string; createdTime?: string };

async function listPersonFolders(token: string, rootId: string, kind: ArchiveKind, personId: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and trashed=false and '${rootId}' in parents` +
      ` and appProperties has { key='altonPersonId' and value='${personId}' }` +
      ` and appProperties has { key='altonKind' and value='${kind}' }`
  );
  const res = await driveFetch(
    `${DRIVE_API}/files?q=${q}&includeItemsFromAllDrives=true&supportsAllDrives=true&orderBy=createdTime&fields=files(id,name,createdTime)`,
    token
  );
  return ((await res.json()) as { files?: DriveFile[] }).files ?? [];
}

/**
 * Finds (by appProperties, so renames and look-alike names never matter) or creates the person's folder under the root.
 * Concurrency: after creating, the folder list is re-read and the OLDEST folder wins; a loser trashes its own empty
 * duplicate, so parallel workers converge on one folder. The folder name is refreshed when the person was renamed.
 */
export async function findOrCreatePersonFolder(
  token: string,
  p: { rootId: string; kind: ArchiveKind; personId: string; displayName: string }
): Promise<string> {
  const desiredName = personFolderName(p.displayName, p.personId);
  let folders = await listPersonFolders(token, p.rootId, p.kind, p.personId);
  let createdId: string | null = null;
  if (folders.length === 0) {
    const res = await driveFetch(`${DRIVE_API}/files?supportsAllDrives=true&fields=id`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: desiredName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [p.rootId],
        appProperties: { altonPersonId: p.personId, altonKind: p.kind },
      }),
    });
    createdId = ((await res.json()) as { id: string }).id;
    folders = await listPersonFolders(token, p.rootId, p.kind, p.personId);
    if (folders.length === 0) return createdId; // listing lag: our own folder is the only candidate
  }
  const winner = folders[0];
  if (createdId && winner.id !== createdId) {
    await driveFetch(`${DRIVE_API}/files/${createdId}?supportsAllDrives=true`, token, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    }).catch(() => undefined);
  }
  if (winner.name !== desiredName) {
    await driveFetch(`${DRIVE_API}/files/${winner.id}?supportsAllDrives=true`, token, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: desiredName }),
    }).catch(() => undefined);
  }
  return winner.id;
}
