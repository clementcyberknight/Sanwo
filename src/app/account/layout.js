import SideMenu from "../components/side_menu";

export default function AccountLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-white">
      <SideMenu />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
