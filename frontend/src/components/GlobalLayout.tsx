import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';

export default function GlobalLayout() {
  return (
    <>
      <Navigation />
      <main className="pt-16 min-h-screen">
        <Outlet />
      </main>
    </>
  );
}
