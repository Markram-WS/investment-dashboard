import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default [
  { ignores: ['dist'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...reactRefresh.configs.vite.rules,
    },
  },
  {
    // Migrated controls: no literal font sizes. Add each screen as it adopts
    // Field/TextInput/NumberInput/SelectInput.
    files: [
      'src/screens/ZoneGroupModal.tsx',
      'src/screens/AssetGroupModal.tsx',
      'src/screens/AddAssetModal.tsx',
      'src/screens/EditAssetModal.tsx',
      'src/screens/EditOrderModal.tsx',
      'src/screens/CloseOrderModal.tsx',
      'src/screens/AddOrderModal.tsx',
      'src/screens/EditPortfolioModal.tsx',
      'src/screens/MFEditPortfolioModal.tsx',
      'src/screens/MFEditOrderModal.tsx',
      'src/screens/MFCreateOrderModal.tsx',
      'src/screens/MFSellHoldingModal.tsx',
      'src/screens/MFRebalanceRecommendModal.tsx',
      'src/pages/TransactionsPage.tsx',
      'src/screens/components/Field.tsx',
      'src/screens/PortfolioMutualFund.tsx',
      'src/screens/components/TradeHistoryTable.tsx',
      'src/screens/components/OptionsStrategyTable.tsx',
      'src/screens/components/TradePlanView.tsx',
      'src/screens/components/StrategyNotes.tsx',
      'src/screens/components/TagsSection.tsx',
      'src/screens/components/PerformanceSection.tsx',
      'src/screens/components/PerformanceChart.tsx',
      'src/screens/components/GroupCombobox.tsx',
      'src/pages/PortfolioOverview.tsx',
      'src/components/NotificationBell.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Property[key.name='fontSize'][value.type='Literal']",
          message: 'Use a control/type token instead of a literal fontSize.',
        },
        {
          selector: "Property[key.name='fontSize'][value.type='TemplateLiteral']",
          message: 'Use a control/type token instead of a literal fontSize.',
        },
      ],
    },
  },
]
