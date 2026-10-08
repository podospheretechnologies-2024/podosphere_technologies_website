import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { approvalService } from '@/modules/social/server/approvals/approval.service';
import { prisma } from '@/shared/lib/prisma';

export const metadata = { title: 'Approvals Portal | Podo Social' };

export default async function ApproverPortalPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('approver_session')?.value;

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm text-center border border-gray-200">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500">Your session has expired. Please use the magic link from your email.</p>
        </div>
      </div>
    );
  }

  let session;
  try {
    session = await approvalService.verifyToken(token);
  } catch (err) {
    redirect('/api/approver/logout'); // or just clear cookie
  }

  // Fetch pending drafts for this client
  const drafts = await prisma.socialPost.findMany({
    where: {
      organizationId: session.organizationId,
      integration: { customerId: session.customerId },
      state: 'DRAFT',
      deletedAt: null,
      parentPostId: null,
    },
    include: { integration: true },
    orderBy: { publishDate: 'asc' },
  });

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="font-bold text-lg tracking-tight">Client Approval Portal</h1>
          <button className="text-sm text-gray-500 hover:text-gray-900 transition">Log out</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">Posts waiting for your approval</h2>
          <p className="text-gray-500 mt-1">Review your upcoming social media content.</p>
        </div>

        {drafts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-1">All caught up!</h3>
            <p className="text-gray-500">There are no posts currently waiting for your approval.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {drafts.map((draft) => (
              <div key={draft.id} className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  {draft.integration.picture ? (
                    <img src={draft.integration.picture} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-100" />
                  )}
                  <div>
                    <div className="text-sm font-medium">{draft.integration.name}</div>
                    <div className="text-xs text-gray-500">
                      Scheduled for {draft.publishDate.toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-gray-700 whitespace-pre-wrap mb-6 flex-grow">
                  {draft.content}
                </p>

                <div className="flex gap-3 pt-4 border-t border-gray-100 mt-auto">
                  <button className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition">
                    Request Edit
                  </button>
                  <button className="flex-1 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition">
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
