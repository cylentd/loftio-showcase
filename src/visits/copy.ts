import { LINK_TTL_SECONDS, SECONDS_PER_HOUR } from './constants';

// Hosted-link copy. {name}, {lifetime} and {time} are filled by the caller; the failure keys equal LinkFailure in link-client.ts.
// The lifetime is LINK_TTL_SECONDS, the same number the server expires links with, shown in whole hours ("1 hour").
const HOURS = LINK_TTL_SECONDS / SECONDS_PER_HOUR;
export const LINK_LIFETIME = `${HOURS} ${HOURS === 1 ? 'hour' : 'hours'}`;
export const LINK_COPY = {
  create: 'Create link', creating: 'Making your link…', checking: 'Checking that you are a person…',
  ready: `Your link is ready to send. It works for ${LINK_LIFETIME}.`,
  field: 'Invitation link',
  copy: 'Copy link', copied: 'Copied. Paste it to your friend.', copyUnavailable: 'Copying is not available here. The link is selected: copy it from the box.',
  copyFailed: 'The link could not be copied. It is selected: copy it from the box.',
  share: 'Share link', shared: 'Link handed to your share app.', cancelled: 'Sharing cancelled.',
  shareFailed: 'Sharing was unavailable. Copy the link instead.',
  privacy: 'Anyone with the link can see {name} for {lifetime}, until {time}. Nothing else from your loft is shared.',
  'not-found': `This invitation is no longer available. Links last ${LINK_LIFETIME}; ask your friend to send a new one.`,
  offline: 'You seem to be offline. Your loft has not changed. Try the link again when you are back online.',
  'rate-limited': 'Too many links were made just now. Try again shortly, or use the file below.',
  'human-check': 'We could not confirm you are a person, so no link was made. Try again, or use the file below.',
  unavailable: 'Invitation links are unavailable right now. You can use the file below instead.',
  'too-large': 'This portrait is too large for a link. You can use the file below instead.',
  invalid: 'This resident cannot be shared as a link. You can use the file below instead.',
  'no-fit': 'This portrait is too large for a link, even when made smaller. You can use the file below instead.',
};
export const COPY = {
  inviteName: 'You can view this resident, but this name cannot be used on an invitation.',
  partial: 'Some guests could not appear in the room. You can still end their visits here.',
  title: 'A little visit', close: 'Close resident viewer', inspect: 'View resident',
  open: 'Open invitation', guests: 'Visiting your loft', empty: 'No guests yet. Open an invitation from a friend.',
  share: 'Share invitation', download: 'Download invitation', welcome: 'Welcome', cancel: 'Cancel', notNow: 'Not now',
  fileRoute: 'Or send it as a file:', shareFile: 'Share file', downloadFile: 'Download file', retry: 'Try again', done: 'Close', opening: 'Opening your invitation…',
  remove: 'End visit', confirmRemove: 'End this visit?', removeHelp: 'This guest will leave your loft. Your own residents stay.',
  preview: 'A friend invited this resident to visit your loft. Nothing is added unless you tap Welcome.',
  owned: 'Send this invitation to a friend. Your resident stays here.', guest: 'Visiting your loft until you end their visit.',
  loading: 'Opening artwork…', saving: 'Welcoming…', welcomed: 'Your guest is in the loft.',
  duplicate: 'This guest is already in your loft.', shared: 'Invitation handed to your share app.',
  downloaded: 'Download requested. Send the invitation file to your friend.', cancelled: 'Sharing cancelled.',
  invalid: 'This is not a supported Loftio invitation.', large: 'This invitation is too large.',
  unsupported: 'This artwork cannot be shared yet. Choose a finished painted resident.',
  storage: 'The visit could not be saved. Check your browser storage and try again.',
  load: 'Saved guests could not be restored. Reload to try again.',
  capacity: 'Your loft has four guests. End a visit before welcoming another.',
  shareFailed: 'Sharing was unavailable. You can download the invitation instead.',
  failed: 'The artwork could not be opened. Your loft has not changed.',
};
