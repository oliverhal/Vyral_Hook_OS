// Public privacy policy linked from the Facebook and Google OAuth consent
// screens used by the comments bot. Not behind login.
export const metadata = { title: "Privacy policy · Vyral Hook OS" };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-16 px-6">
      <article className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-slate-700 text-sm leading-relaxed space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Privacy policy</h1>
        <p className="text-slate-500">Vyral Hook OS · Vyral Labs · Last updated 30 October 2026</p>

        <p>
          Vyral Hook OS is an internal tool used by the Vyral Labs team to manage creator campaigns. Creators and
          account managers can connect a Facebook Page or YouTube channel they manage so the tool can read comments on
          that account&apos;s videos and post replies on its behalf.
        </p>

        <h2 className="text-base font-semibold text-slate-900 pt-2">What we access</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>The list of Facebook Pages or the YouTube channel you choose to connect, with its name and id.</li>
          <li>Comments (and reply authors) on videos posted by those connected accounts.</li>
          <li>Permission to post replies to those comments as the connected Page or channel.</li>
        </ul>

        <h2 className="text-base font-semibold text-slate-900 pt-2">How we use it</h2>
        <p>
          Comments are used only to decide which ones deserve a reply and to draft and post that reply from the
          connected account. We don&apos;t sell this data, use it for advertising, or share it with anyone outside Vyral
          Labs, other than the AI service that drafts replies.
        </p>

        <h2 className="text-base font-semibold text-slate-900 pt-2">Storage and security</h2>
        <p>
          Access tokens are stored encrypted. Comment data is kept only as long as it&apos;s useful for the campaign and is
          deleted when an account is disconnected or on request.
        </p>

        <h2 className="text-base font-semibold text-slate-900 pt-2">Removing access</h2>
        <p>
          You can disconnect an account in Vyral Hook OS at any time, or revoke access from your Facebook settings
          (Business Integrations) or your Google account (Third-party apps &amp; services). YouTube data is handled in
          line with the{" "}
          <a className="text-blue-600 underline" href="https://policies.google.com/privacy">Google Privacy Policy</a>.
        </p>

        <h2 className="text-base font-semibold text-slate-900 pt-2">Contact</h2>
        <p>
          Questions or deletion requests: <a className="text-blue-600 underline" href="mailto:oliver@vyral-labs.com">oliver@vyral-labs.com</a>
        </p>
      </article>
    </main>
  );
}
