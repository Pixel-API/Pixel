import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const componentPath = resolve(dirname(fileURLToPath(import.meta.url)), '../AppSidebar.vue')
const componentSource = readFileSync(componentPath, 'utf8')
const stylePath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../style.css')
const styleSource = readFileSync(stylePath, 'utf8')

describe('AppSidebar custom SVG styles', () => {
  it('does not override uploaded SVG fill or stroke colors', () => {
    expect(componentSource).toContain('.sidebar-svg-icon {')
    expect(componentSource).toContain('color: currentColor;')
    expect(componentSource).toContain('display: block;')
    expect(componentSource).not.toContain('stroke: currentColor;')
    expect(componentSource).not.toContain('fill: none;')
  })
})

describe('AppSidebar header styles', () => {
  it('does not clip the version badge dropdown', () => {
    const sidebarHeaderBlockMatch = styleSource.match(/\.sidebar-header\s*\{[\s\S]*?\n {2}\}/)
    const sidebarBrandBlockMatch = componentSource.match(/\.sidebar-brand\s*\{[\s\S]*?\n\}/)

    expect(sidebarHeaderBlockMatch).not.toBeNull()
    expect(sidebarBrandBlockMatch).not.toBeNull()
    expect(sidebarHeaderBlockMatch?.[0]).not.toContain('@apply overflow-hidden;')
    expect(sidebarBrandBlockMatch?.[0]).not.toContain('overflow: hidden;')
  })
})

describe('AppSidebar user navigation', () => {
  const buildSelfNavItemsBlock = componentSource.match(/function buildSelfNavItems\(withDashboard: boolean\): NavItem\[] \{[\s\S]*?\n\}/)?.[0] ?? ''
  const adminNavItemsBlock = componentSource.match(/const adminNavItems = computed\(\(\): NavItem\[] => \{[\s\S]*?\n\}\)/)?.[0] ?? ''

  it('hides account, channel status, and subscription tabs from the user menu', () => {
    expect(buildSelfNavItemsBlock).not.toContain("path: '/accounts'")
    expect(buildSelfNavItemsBlock).not.toContain("path: '/monitor'")
    expect(buildSelfNavItemsBlock).not.toContain("path: '/subscriptions'")
    expect(buildSelfNavItemsBlock).not.toContain("t('nav.myAccounts')")
    expect(buildSelfNavItemsBlock).not.toContain("t('nav.channelStatus')")
    expect(buildSelfNavItemsBlock).not.toContain("t('nav.mySubscriptions')")
  })

  it('keeps the corresponding admin management entries available', () => {
    expect(adminNavItemsBlock).toContain("path: '/admin/accounts'")
    expect(adminNavItemsBlock).toContain("path: '/admin/channels/monitor'")
    expect(adminNavItemsBlock).toContain("path: '/admin/subscriptions'")
  })
})
