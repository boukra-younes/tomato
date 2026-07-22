import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'
import { format } from 'date-fns'

export const useAppStore = create((set, get) => ({
  selectedDate: format(new Date(), 'yyyy-MM-dd'),
  foodLogs: [],
  waterLogs: [],
  caffeineLogs: [],
  alcoholLogs: [],
  exerciseLogs: [],
  healthLogs: [],
  loading: false,

  setSelectedDate: (d) => set({ selectedDate: d }),

  fetchDayData: async (userId, date) => {
    set({ loading: true })
    const [foods, water, caffeine, alcohol, exercise, health] = await Promise.all([
      supabase.from('food_logs').select('*').eq('user_id', userId).eq('log_date', date).order('created_at'),
      supabase.from('water_logs').select('*').eq('user_id', userId).eq('log_date', date),
      supabase.from('caffeine_logs').select('*').eq('user_id', userId).eq('log_date', date),
      supabase.from('alcohol_logs').select('*').eq('user_id', userId).eq('log_date', date),
      supabase.from('exercise_logs').select('*').eq('user_id', userId).eq('log_date', date),
      supabase.from('health_logs').select('*').eq('user_id', userId).eq('log_date', date)
    ])
    set({
      foodLogs: foods.data || [],
      waterLogs: water.data || [],
      caffeineLogs: caffeine.data || [],
      alcoholLogs: alcohol.data || [],
      exerciseLogs: exercise.data || [],
      healthLogs: health.data || [],
      loading: false
    })
  },

  addFoodLog: async (userId, entry) => {
    const { data, error } = await supabase.from('food_logs').insert({ ...entry, user_id: userId }).select().single()
    if (error) throw error
    set({ foodLogs: [...get().foodLogs, data] })
    return data
  },

  deleteFoodLog: async (id) => {
    await supabase.from('food_logs').delete().eq('id', id)
    set({ foodLogs: get().foodLogs.filter(f => f.id !== id) })
  },

  addWaterLog: async (userId, amountMl, date) => {
    const { data, error } = await supabase.from('water_logs').insert({ user_id: userId, amount_ml: amountMl, log_date: date }).select().single()
    if (error) throw error
    set({ waterLogs: [...get().waterLogs, data] })
  },

  addExerciseLog: async (userId, entry) => {
    const { data, error } = await supabase.from('exercise_logs').insert({ ...entry, user_id: userId }).select().single()
    if (error) throw error
    set({ exerciseLogs: [...get().exerciseLogs, data] })
  },

  addHealthLog: async (userId, entry, date) => {
    const { data, error } = await supabase.from('health_logs').upsert({ ...entry, user_id: userId, log_date: date }).select().single()
    if (error) throw error
    const others = get().healthLogs.filter(h => h.log_date !== date)
    set({ healthLogs: [...others, data] })
  }
}))
