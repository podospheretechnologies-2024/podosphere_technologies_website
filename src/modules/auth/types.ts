export interface CurrentUserItem {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  organization: { id: string; name: string };
}
