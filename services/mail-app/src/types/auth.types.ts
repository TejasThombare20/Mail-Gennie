// export interface IGoogleTokens {
//     access_token: string;
//     refresh_token?: string;
//     expiry_date: Date;
//   }

export interface IGoogleTokens {
  access_token: string;
  refresh_token: string;
  id_token: string;
  expiry_date: number;
}

export interface IGoogleUserInfo {
  email: string;
  name: string;
  picture: string;
  id : string;
}
