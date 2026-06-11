export interface IUser {
    id: string;
    email: string;
    name: string;
    picture?: string;
    created_at: Date;
    updated_at: Date;
  }
  
  export interface ICreateUser {
    email: string;
    name: string;
    picture?: string;
    id? : string;
  }

  export interface IUserToken {
    user_id: string;
    google_token: string;
    token_expiry: Date;
    refresh_token?: string;
    created_at: Date;
    updated_at: Date;
  }