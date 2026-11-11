import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';

export default function GlobalLayout() {
  return (
    <>
      <Navigation />
      <main className="min-h-[calc(100vh-60px)]">
        <Outlet />
      </main>
    </>
  );
}
