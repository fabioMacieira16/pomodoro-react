import React, { useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Brain, Target, TrendingUp, Flame, BookOpen, Clock } from 'lucide-react';
import { useAnkiStore } from '../../store/ankiStore';

const MATURITY_COLORS = ['#94a3b8', '#f97316', '#3b82f6', '#22c55e'];

export function AnkiDashboard() {
  const { stats, fetchStats, isLoadingStats } = useAnkiStore();

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (isLoadingStats) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    { label: 'Para Revisar Hoje', value: stats.due_today + stats.new_cards, icon: Clock, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    { label: 'Retenção (30d)', value: `${stats.retention_rate}%`, icon: Target, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Precisão Geral', value: `${stats.accuracy_rate}%`, icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
    { label: 'Sequência', value: `${stats.streak_days}d`, icon: Flame, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
    { label: 'Total de Cartões', value: stats.total_cards, icon: BookOpen, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { label: 'Revisões Totais', value: stats.total_reviews, icon: Brain, color: 'text-teal-500', bg: 'bg-teal-50 dark:bg-teal-900/20' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Dashboard Anki</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`rounded-xl p-4 ${bg}`}>
            <Icon size={20} className={`mb-2 ${color}`} />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly reviews */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Revisões (7 dias)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.weekly_reviews}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => new Date(v + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' })} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [v, 'Revisões']} />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cards by maturity */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Maturidade dos Cartões</h3>
          {stats.total_cards > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={stats.cards_by_maturity.filter((b) => b.count > 0)}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {stats.cards_by_maturity.map((_, i) => (
                    <Cell key={i} fill={MATURITY_COLORS[i % MATURITY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-400 text-sm">
              Nenhum cartão ainda
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
