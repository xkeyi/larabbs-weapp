import wepy from 'wepy'

// 服务器接口地址
const host = 'http://larabbs.test/api'

// 普通请求
const request = async (options, showLoading = true) => {
  // 简化开发，如果传入字符串则转换成对象
  if (typeof options === 'string') {
    options = {
      url: options
    }
  }

  // 显示加载中
  if (showLoading) {
    wepy.showLoading({title: '加载中'})
  }

  // 拼接请求地址
  options.url = host + '/' + options.url
  // 调用小程序的 request 方法
  let response = await wepy.request(options)

  if (showLoading) {
    wepy.hideLoading()
  }

  // 服务器异常后给与提示
  if (response.statusCode === 500) {
    wepy.showModal({
      title: '提示',
      content: '服务器错误，请联系管理员或重试'
    })
  }

  return response
}

// 登录
const login = async (params = {}) => {
  // code 只能使用一次，所以每次单独调用
  let loginData = await wepy.login()

  // 参数中增加 code
  params.code = loginData.code

  // 接口请求 weapp/authorizations
  let authResponse = await request({
    url: 'weapp/authorizations',
    data: params,
    method: 'POST'
  })

  // 登录成功，记录 token 信息
  if (authResponse.statusCode === 201) {
    wepy.setStorageSync('access_token', authResponse.data.access_token)
    wepy.setStorageSync('access_token_expired_at', new Date().getTime() + authResponse.data.expires_in * 1000)
  }

  return authResponse
}

// 带身份认证的请求
const authRequest = async (options, showLoading = true) => {
  if (typeof options === 'string') {
    options = {
      url: options
    }
  }

  // 获取 Token
  let accessToken = await getToken()

  // 将 token 设置在 header 中
  let header = options.header || {}
  header.Authorization = 'Bearer' + accessToken
  options.header = header

  return request(options, showLoading)
}

// 获取 Token
const getToken = async (options) =>  {
  // 从缓存中取出 Token
  let accessToken = wepy.getStorageSync('access_token')
  let expiredAt = wepy.getStorageSync('access_token_expired_at')

  // 如果 token 过期了，则调用刷新方法
  if (accessToken && new Date().getTime() > expiredAt) {
    let refreshReponse = await refreshToken(accessToken)

    if (refreshReponse.statusCode === 200) {
      accessToken = refreshReponse.data.access_token
    } else {
      // 刷新失败，重新调用登录方法，设置 Token
      let authResponse = await login()
      if (authResponse.statusCode === 201) {
        accessToken = authResponse.data.access_token
      }
    }
  }

  return accessToken
}

// 刷新 Token
const refreshToken = async (accessToken) => {
  // 请求刷新接口
  let refreshReponse = await wepy.request({
    url: host + '/' + 'authorizations/current',
    method: 'PUT',
    header: {
      'Authorization' : 'Bearer' + accessToken
    }
  })

  if (refreshReponse.statusCode === 200) {
    wepy.setStorageSync('access_token', refreshReponse.data.access_token)
    wepy.setStorageSync('access_token_expired_at', new Date().getTime() + refreshReponse.data.expires_in * 1000)
  }

  return refreshReponse
}

// 退出登录
const logout = async (params = {}) => {
  let accessToken = wepy.getStorageSync('access_token')

  let logoutResponse = await wepy.request({
    url: host + '/' + 'authorizations/current',
    method: 'DELETE',
    header: {
      'Authorization': 'Bearer' + accessToken
    }
  })

  if (logoutResponse.statusCode === 204) {
    wepy.clearStorage()
  }

  return logoutResponse
}

export default {
  request,
  authRequest,
  refreshToken,
  login,
  logout
}
