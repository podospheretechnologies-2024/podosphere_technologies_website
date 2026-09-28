export interface NavItem {
  label: string;
  href: string;
  description?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}
