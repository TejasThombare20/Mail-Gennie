import { supabase } from "../config/MediaStorageClient";

export async function getNewSignedUrl(fileName: string) {
    const { data, error } = await supabase
      .storage
      .from(import.meta.env.VITE_SUPABASE_BUCKET_NAME)
      .createSignedUrl(fileName, 3600); // 1 hour expiration
  
    if (error) throw error;
    return data.signedUrl;  
  } 