/**
 * Why this file exists: on a client-side navigation, a slot that does NOT match the new URL keeps
 * showing what it showed before. Without this catch-all, clicking a <Link> to /cart while the
 * modal is open would leave the modal on screen. Matching everything else with `null` closes it.
 */
export default function CatchAll() {
  return null;
}
