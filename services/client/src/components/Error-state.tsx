import React from "react";
import { AlertCircle } from "lucide-react";

const ErrorState = ({ message }: { message: string }) => (
  <div className="w-full flex flex-col items-center justify-center p-8 text-center">
    <AlertCircle className="w-12 h-12 text-red-500 dark:text-red-400 mb-4" />
    <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
      Oops! Something went wrong
    </h3>
    <p className="text-gray-600 dark:text-gray-400">{message}</p>
  </div>
);

export default ErrorState;