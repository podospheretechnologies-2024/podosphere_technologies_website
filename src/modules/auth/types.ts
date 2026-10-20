export interface CurrentUserItem {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  isPlatformAdmin: boolean;
  organization: { id: string; name: string };
}
