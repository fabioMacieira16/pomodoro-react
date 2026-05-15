import React from 'react';
import { createRoot } from 'react-dom/client';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DndProvider } from 'react-dnd';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Pomodoro from './containers/Pomodoro';
import Dashboard from './containers/Dashboard';
import Scheduler from './containers/Scheduler';
import './style.css';

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <DndProvider backend={HTML5Backend}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Pomodoro />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/scheduler" element={<Scheduler />} />
        </Routes>
      </BrowserRouter>
    </DndProvider>
  </React.StrictMode>
);
