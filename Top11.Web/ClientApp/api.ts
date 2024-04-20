import axios from 'axios';


interface UserInfo {
  username: string;
}



export const GetUsetInfo = async (): UserInfo => {
  try {
    var res = await axios.get<UserInfo>('/auth');
    


    return res.data;


  } catch (e) {
    throw e;
  }
};
