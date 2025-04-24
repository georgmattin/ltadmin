'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function SupabaseExample() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Replace 'your_table' with an actual table from your Supabase project
        const { data, error } = await supabase
          .from('your_table')
          .select('*')
          .limit(10);

        if (error) {
          throw error;
        }

        setData(data || []);
      } catch (error: any) {
        setError(error.message || 'An error occurred while fetching data');
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Supabase Data Example</h2>
      
      {loading ? (
        <p>Loading data...</p>
      ) : error ? (
        <div className="text-red-500">
          <p>Error: {error}</p>
          <p className="mt-2 text-sm">
            Make sure you have:
            <ul className="list-disc ml-5 mt-1">
              <li>Set up your Supabase URL and anon key in .env.local</li>
              <li>Created a table in your Supabase project</li>
              <li>Updated the table name in this component</li>
            </ul>
          </p>
        </div>
      ) : (
        <div>
          <p className="mb-2">Data from Supabase:</p>
          {data.length === 0 ? (
            <p>No data found</p>
          ) : (
            <pre className="bg-gray-100 p-4 rounded overflow-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
} 