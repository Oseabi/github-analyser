// ---- ELEMENTS ----
const usernameInput = document.getElementById('username-input')
const analyseBtn = document.getElementById('analyse-btn')
const results = document.getElementById('results')
const loading = document.getElementById('loading')
const errorState = document.getElementById('error-state')
const emptyState = document.getElementById('empty-state')
const themeToggle = document.getElementById('theme-toggle')
const themeIcon = document.querySelector('.theme-icon')
const themeLabel = document.querySelector('.theme-label')

// ---- THEME ----
const savedTheme = localStorage.getItem('analyserTheme') || 'light'
document.documentElement.setAttribute('data-theme', savedTheme)
updateThemeBtn(savedTheme)

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme')
  const next = current === 'light' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('analyserTheme', next)
  updateThemeBtn(next)
})

function updateThemeBtn(theme) {
  if (theme === 'dark') {
    themeIcon.textContent = '☀️'
    themeLabel.textContent = 'Light mode'
  } else {
    themeIcon.textContent = '🌙'
    themeLabel.textContent = 'Dark mode'
  }
}

// ---- UI STATE MANAGER ----
function showState(state) {
  loading.classList.add('hidden')
  results.classList.add('hidden')
  errorState.classList.add('hidden')
  emptyState.classList.add('hidden')

  if (state === 'loading') loading.classList.remove('hidden')
  if (state === 'results') results.classList.remove('hidden')
  if (state === 'error') errorState.classList.remove('hidden')
  if (state === 'empty') emptyState.classList.remove('hidden')
}

showState('empty')

// ---- SIDEBAR NAV ----
const navItems = document.querySelectorAll('.nav-item')

const sectionMap = {
  overview: ['section-overview', 'section-stats'],
  languages: ['section-grid'],
  repos: ['section-grid'],
  score: ['section-score', 'section-breakdown'],
}

const allSections = [
  'section-overview',
  'section-stats',
  'section-grid',
  'section-score',
  'section-breakdown',
]

function setActiveNav(selectedItem) {
  navItems.forEach(n => n.classList.remove('active'))
  selectedItem.classList.add('active')

  if (results.classList.contains('hidden')) return

  const section = selectedItem.dataset.section

  allSections.forEach((id) => {
    const el = document.getElementById(id)
    if (el) el.classList.add('hidden')
  })

  const toShow = sectionMap[section] || allSections
  toShow.forEach((id) => {
    const el = document.getElementById(id)
    if (el) el.classList.remove('hidden')
  })
}

navItems.forEach((item) => {
  item.addEventListener('click', () => setActiveNav(item))
})

function resetNav() {
  allSections.forEach((id) => {
    const el = document.getElementById(id)
    if (el) el.classList.remove('hidden')
  })
  navItems.forEach(n => n.classList.remove('active'))
  navItems[0].classList.add('active')
}

// ---- TRIGGER ANALYSE ----
analyseBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim()
  if (username === '') {
    alert('Please enter a GitHub username.')
    return
  }
  analyseProfile(username)
})

usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') analyseBtn.click()
})

// ---- LANGUAGE COLORS ----
const langColors = {
  JavaScript: '#f7df1e',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  HTML: '#e34c26',
  CSS: '#264de4',
  Java: '#b07219',
  'C#': '#178600',
  PHP: '#4F5D95',
  Ruby: '#701516',
  Go: '#00ADD8',
  Rust: '#dea584',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Vue: '#41b883',
  Shell: '#89e051',
}

// ---- MAIN ANALYSE FUNCTION ----
async function analyseProfile(username) {

  showState('loading')
  analyseBtn.disabled = true
  analyseBtn.textContent = 'Analysing...'

  try {

    // Fetch user and repos at the same time
    const [userResponse, reposResponse] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`),
      fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`)
    ])

    if (!userResponse.ok) {
      showState('error')
      return
    }

    const [user, repos] = await Promise.all([
      userResponse.json(),
      reposResponse.json()
    ])

    // Update loading message
    document.querySelector('.loading p').textContent = 'Analysing languages...'

    // Fetch languages for every repo at the same time
    const languageData = await fetchAllLanguages(repos)

    const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0)
    const languages = getLanguages(languageData)
    const topRepos = getTopRepos(repos)
    const { score, grade, desc, breakdown } = calculateScore(user, repos)

    renderProfile(user, totalStars)
    renderScore(score, grade, desc)
    renderStatCards(user, totalStars, languages)
    renderLanguages(languages)
    renderRepos(topRepos)
    renderBreakdown(breakdown)

    resetNav()
    showState('results')

  } catch (error) {
    console.error('Error:', error)
    showState('error')
  } finally {
    analyseBtn.disabled = false
    analyseBtn.textContent = 'Analyse →'
    document.querySelector('.loading p').textContent = 'Fetching GitHub data...'
  }

}

// ---- FETCH LANGUAGES PER REPO ----
async function fetchAllLanguages(repos) {

  // Only fetch non-fork repos — max 30 to avoid hitting rate limits
  const targetRepos = repos
    .filter(repo => !repo.fork)
    .slice(0, 30)

  // Fetch languages for all repos at the same time
  const responses = await Promise.all(
    targetRepos.map(repo => fetch(repo.languages_url))
  )

  // Convert all responses to JSON at the same time
  const languageResults = await Promise.all(
    responses.map(res => res.json())
  )

  // Merge all language byte counts into one object
  const merged = {}
  languageResults.forEach((repoLangs) => {
    Object.entries(repoLangs).forEach(([lang, bytes]) => {
      merged[lang] = (merged[lang] || 0) + bytes
    })
  })

  return merged
}

// ---- PROCESS LANGUAGES ----
function getLanguages(languageData) {

  const total = Object.values(languageData).reduce((sum, bytes) => sum + bytes, 0)

  if (total === 0) return []

  return Object.entries(languageData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, bytes]) => ({
      name,
      percentage: Math.round((bytes / total) * 100)
    }))
    .filter(lang => lang.percentage > 0)
}

// ---- TOP REPOS ----
function getTopRepos(repos) {
  return repos
    .filter(repo => !repo.fork)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 5)
}

// ---- CALCULATE SCORE ----
function calculateScore(user, repos) {
  const breakdown = []
  let score = 0

  const avatarPoints = user.avatar_url && !user.avatar_url.includes('identicons') ? 10 : 0
  breakdown.push({ label: 'Profile avatar', points: avatarPoints, max: 10 })
  score += avatarPoints

  const bioPoints = user.bio ? 15 : 0
  breakdown.push({ label: 'Profile bio', points: bioPoints, max: 15 })
  score += bioPoints

  const locationPoints = user.location ? 5 : 0
  breakdown.push({ label: 'Location set', points: locationPoints, max: 5 })
  score += locationPoints

  const repoPoints = Math.min(user.public_repos * 2, 20)
  breakdown.push({ label: `${user.public_repos} public repos`, points: repoPoints, max: 20 })
  score += repoPoints

  const totalStars = repos.reduce((sum, r) => sum + r.stargazers_count, 0)
  const starPoints = Math.min(totalStars * 2, 20)
  breakdown.push({ label: `${totalStars} total stars`, points: starPoints, max: 20 })
  score += starPoints

  const followerPoints = Math.min(user.followers, 15)
  breakdown.push({ label: `${user.followers} followers`, points: followerPoints, max: 15 })
  score += followerPoints

  const hasReadme = repos.some(r => r.description && r.description.length > 20)
  const readmePoints = hasReadme ? 10 : 0
  breakdown.push({ label: 'Repos with descriptions', points: readmePoints, max: 10 })
  score += readmePoints

  const websitePoints = user.blog ? 5 : 0
  breakdown.push({ label: 'Website or blog link', points: websitePoints, max: 5 })
  score += websitePoints

  let grade = 'F'
  let desc = ''
  if (score >= 90) { grade = 'A+'; desc = 'Outstanding profile. Recruiters will notice.' }
  else if (score >= 80) { grade = 'A'; desc = 'Excellent profile. Very recruiter friendly.' }
  else if (score >= 70) { grade = 'B+'; desc = 'Great profile. A few tweaks and you\'re there.' }
  else if (score >= 60) { grade = 'B'; desc = 'Good profile. Keep building and sharing.' }
  else if (score >= 50) { grade = 'C'; desc = 'Average profile. More projects will help.' }
  else if (score >= 40) { grade = 'D'; desc = 'Needs work. Add a bio and more projects.' }
  else { grade = 'F'; desc = 'Just getting started. Keep going!' }

  return { score, grade, desc, breakdown }
}

// ---- RENDER PROFILE ----
function renderProfile(user, totalStars) {
  document.getElementById('profile-avatar').src = user.avatar_url
  document.getElementById('profile-name').textContent = user.name || user.login
  document.getElementById('profile-login').textContent = `@${user.login} · joined ${new Date(user.created_at).getFullYear()}`
  document.getElementById('profile-bio').textContent = user.bio || 'No bio provided.'
  document.getElementById('stat-repos').textContent = user.public_repos
  document.getElementById('stat-followers').textContent = user.followers
  document.getElementById('stat-following').textContent = user.following
  document.getElementById('stat-stars').textContent = totalStars
}

// ---- RENDER SCORE ----
function renderScore(score, grade, desc) {
  document.getElementById('score-num').textContent = score
  document.getElementById('score-grade').textContent = grade
  document.getElementById('score-desc').textContent = desc
}

// ---- RENDER STAT CARDS ----
function renderStatCards(user, totalStars, languages) {
  document.getElementById('card-repos').textContent = user.public_repos
  document.getElementById('card-stars').textContent = totalStars
  document.getElementById('card-followers').textContent = user.followers
  document.getElementById('card-top-lang').textContent = languages[0]?.name || '—'
}

// ---- RENDER LANGUAGES ----
function renderLanguages(languages) {
  const list = document.getElementById('languages-list')
  list.innerHTML = ''

  if (languages.length === 0) {
    list.innerHTML = '<p style="font-size:0.82rem; color:var(--text-tertiary);">No languages found.</p>'
    return
  }

  languages.forEach((lang) => {
    const color = langColors[lang.name] || '#6366f1'
    const div = document.createElement('div')
    div.className = 'lang-item'
    div.innerHTML = `
      <div class="lang-row">
        <span class="lang-name">${lang.name}</span>
        <span class="lang-pct">${lang.percentage}%</span>
      </div>
      <div class="bar-bg">
        <div class="bar-fill" style="width: 0%; background: ${color};"
          data-width="${lang.percentage}%">
        </div>
      </div>
    `
    list.appendChild(div)
  })

  setTimeout(() => {
    document.querySelectorAll('.bar-fill').forEach((bar) => {
      bar.style.width = bar.dataset.width
    })
  }, 100)
}

// ---- RENDER REPOS ----
function renderRepos(repos) {
  const list = document.getElementById('repos-list')
  list.innerHTML = ''

  if (repos.length === 0) {
    list.innerHTML = '<p style="font-size:0.82rem; color:var(--text-tertiary);">No repos found.</p>'
    return
  }

  repos.forEach((repo) => {
    const div = document.createElement('div')
    div.className = 'repo-item'
    div.innerHTML = `
      <span class="repo-name">${repo.name}</span>
      <span class="repo-stars">⭐ ${repo.stargazers_count}</span>
    `
    list.appendChild(div)
  })
}

// ---- RENDER BREAKDOWN ----
function renderBreakdown(breakdown) {
  const list = document.getElementById('breakdown-list')
  list.innerHTML = ''

  breakdown.forEach((item) => {
    const div = document.createElement('div')
    div.className = 'breakdown-item'
    div.innerHTML = `
      <span class="breakdown-label">${item.label}</span>
      <span class="breakdown-points">${item.points} / ${item.max} pts</span>
    `
    list.appendChild(div)
  })
}