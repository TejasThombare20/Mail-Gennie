import React from 'react'
import { Sidebar } from '../components/Left-sidebar';
import { Outlet } from 'react-router-dom';
import Header from '../components/Header';

const DashboardPage = () => {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-1 mx-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default DashboardPage
