const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

export const fetchTransactionsData = async () => {
  const response = await fetch(`${API_BASE_URL}/transactions/`);
  return response.json();
};