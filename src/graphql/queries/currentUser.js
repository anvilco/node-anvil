const defaultResponseQuery = `{
  eid
  name
  email
  role
  organizations {
    eid
    name
    slug
  }
}`

export const generateQuery = (responseQuery = defaultResponseQuery) => `
  query CurrentUser {
    currentUser ${responseQuery}
  }
`
