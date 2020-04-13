import api from '../wrapper/APIWrapper'
import api_state from '../store/WrapperState'

export default async ({ Vue, store }) => {
  api.setStore(store)

  Vue.prototype.$api = api;
}