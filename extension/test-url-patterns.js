/**
 * Test file for URL pattern matching functionality
 * Run with: node test-url-patterns.js
 */

// Import the RulesService for testing
import { rulesService } from "./src/services/RulesService.js"

/**
 * Test URL pattern matching with various patterns
 */
function testUrlPatterns() {
  console.log("🧪 Testing URL Pattern Matching")
  console.log("=================================")

  const testCases = [
    // Basic domain matching (existing functionality)
    {
      pattern: "google.com",
      url: "https://google.com",
      expected: true,
      description: "Exact domain match"
    },
    {
      pattern: "google.com",
      url: "https://docs.google.com",
      expected: false,
      description: "Should not match subdomain when exact domain specified"
    },

    // Subdomain wildcard matching (existing functionality)
    {
      pattern: "*.google.com",
      url: "https://docs.google.com",
      expected: true,
      description: "Subdomain wildcard match"
    },
    {
      pattern: "*.google.com",
      url: "https://google.com",
      expected: true,
      description: "Subdomain wildcard should match base domain"
    },
    {
      pattern: "*.google.com",
      url: "https://mail.google.com",
      expected: true,
      description: "Subdomain wildcard with different subdomain"
    },

    // Domain + path matching (new functionality)
    {
      pattern: "docs.google.com/forms",
      url: "https://docs.google.com/forms",
      expected: true,
      description: "Domain + path exact match"
    },
    {
      pattern: "docs.google.com/forms",
      url: "https://docs.google.com/forms/create",
      expected: true,
      description: "Domain + path prefix match"
    },
    {
      pattern: "docs.google.com/forms",
      url: "https://docs.google.com/sheets",
      expected: false,
      description: "Domain matches but path does not"
    },
    {
      pattern: "docs.google.com/forms",
      url: "https://sheets.google.com/forms",
      expected: false,
      description: "Path matches but domain does not"
    },

    // Subdomain + path matching (new functionality)
    {
      pattern: "*.google.com/forms",
      url: "https://docs.google.com/forms",
      expected: true,
      description: "Subdomain wildcard + path match"
    },
    {
      pattern: "*.google.com/forms",
      url: "https://sheets.google.com/forms",
      expected: true,
      description: "Subdomain wildcard + path match with different subdomain"
    },
    {
      pattern: "*.google.com/forms",
      url: "https://google.com/forms",
      expected: true,
      description: "Subdomain wildcard + path match with base domain"
    },

    // TLD wildcard matching (new functionality)
    {
      pattern: "google.**/forms",
      url: "https://google.com/forms",
      expected: true,
      description: "TLD wildcard + path match (.com)"
    },
    {
      pattern: "google.**/forms",
      url: "https://google.co.il/forms",
      expected: true,
      description: "TLD wildcard + path match (.co.il)"
    },
    {
      pattern: "google.**/forms",
      url: "https://google.org/forms",
      expected: true,
      description: "TLD wildcard + path match (.org)"
    },
    {
      pattern: "google.**/forms",
      url: "https://google.co.uk/forms",
      expected: true,
      description: "TLD wildcard + path match (.co.uk)"
    },
    {
      pattern: "google.**/forms",
      url: "https://google.com/sheets",
      expected: false,
      description: "TLD wildcard but path does not match"
    },
    {
      pattern: "google.**/forms",
      url: "https://docs.google.com/forms",
      expected: false,
      description: "TLD wildcard but domain prefix does not match"
    },

    // Combined subdomain + TLD wildcard (new functionality)
    {
      pattern: "*.google.**/forms",
      url: "https://docs.google.com/forms",
      expected: true,
      description: "Subdomain + TLD wildcard + path match"
    },
    {
      pattern: "*.google.**/forms",
      url: "https://mail.google.co.il/forms",
      expected: true,
      description: "Subdomain + TLD wildcard + path match with different TLD"
    },
    {
      pattern: "*.google.**/forms",
      url: "https://google.org/forms",
      expected: true,
      description: "Subdomain + TLD wildcard + path match with base domain"
    },

    // Edge cases
    {
      pattern: "example.com/",
      url: "https://example.com/",
      expected: true,
      description: "Domain with trailing slash"
    },
    {
      pattern: "example.com",
      url: "https://example.com/anything",
      expected: true,
      description: "Domain-only pattern should match any path"
    },
    {
      pattern: "example.com/path",
      url: "https://example.com/path/",
      expected: true,
      description: "Path pattern should match with trailing slash"
    }
  ]

  let passed = 0
  let failed = 0

  console.log("\n🔍 Running test cases...\n")

  for (const testCase of testCases) {
    try {
      const result = rulesService.urlMatches(testCase.url, testCase.pattern)

      if (result === testCase.expected) {
        console.log(`✅ ${testCase.description}`)
        console.log(
          `   Pattern: ${testCase.pattern} | URL: ${testCase.url} | Expected: ${testCase.expected} | Got: ${result}`
        )
        passed++
      } else {
        console.log(`❌ ${testCase.description}`)
        console.log(
          `   Pattern: ${testCase.pattern} | URL: ${testCase.url} | Expected: ${testCase.expected} | Got: ${result}`
        )
        failed++
      }
    } catch (error) {
      console.log(`💥 ${testCase.description}`)
      console.log(
        `   Pattern: ${testCase.pattern} | URL: ${testCase.url} | Error: ${error.message}`
      )
      failed++
    }

    console.log("")
  }

  console.log("📊 Test Results:")
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`)

  return failed === 0
}

/**
 * Test pattern validation
 */
function testPatternValidation() {
  console.log("\n🧪 Testing Pattern Validation")
  console.log("==============================")

  const validationTests = [
    // Valid patterns
    { pattern: "google.com", expected: true, description: "Basic domain" },
    { pattern: "*.google.com", expected: true, description: "Subdomain wildcard" },
    { pattern: "docs.google.com/forms", expected: true, description: "Domain + path" },
    { pattern: "*.google.com/forms", expected: true, description: "Subdomain wildcard + path" },
    { pattern: "google.**/forms", expected: true, description: "TLD wildcard + path" },
    {
      pattern: "*.google.**/forms",
      expected: true,
      description: "Subdomain + TLD wildcard + path"
    },

    // Invalid patterns
    { pattern: "", expected: false, description: "Empty pattern" },
    { pattern: "invalid", expected: false, description: "Invalid domain format" },
    { pattern: "*.", expected: false, description: "Incomplete subdomain wildcard" },
    { pattern: "google.**", expected: false, description: "TLD wildcard without dot" },
    { pattern: "google.***", expected: false, description: "Invalid TLD wildcard" },
    { pattern: "google.com//forms", expected: false, description: "Double slash in path" },
    {
      pattern: "google.com/forms with spaces",
      expected: false,
      description: "Invalid characters in path"
    }
  ]

  let passed = 0
  let failed = 0

  console.log("\n🔍 Running validation tests...\n")

  for (const test of validationTests) {
    try {
      const result = rulesService.validateRulePattern(test.pattern)
      const isValid = result.isValid

      if (isValid === test.expected) {
        console.log(`✅ ${test.description}`)
        console.log(`   Pattern: "${test.pattern}" | Expected: ${test.expected} | Got: ${isValid}`)
        passed++
      } else {
        console.log(`❌ ${test.description}`)
        console.log(`   Pattern: "${test.pattern}" | Expected: ${test.expected} | Got: ${isValid}`)
        if (!isValid) {
          console.log(`   Error: ${result.error}`)
        }
        failed++
      }
    } catch (error) {
      console.log(`💥 ${test.description}`)
      console.log(`   Pattern: "${test.pattern}" | Error: ${error.message}`)
      failed++
    }

    console.log("")
  }

  console.log("📊 Validation Test Results:")
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`)

  return failed === 0
}

/**
 * Run all tests
 */
function runAllTests() {
  console.log("🚀 Starting URL Pattern Tests")
  console.log("============================")

  const matchingTests = testUrlPatterns()
  const validationTests = testPatternValidation()

  console.log("\n🎯 Final Results:")
  console.log("================")

  if (matchingTests && validationTests) {
    console.log("🎉 All tests passed! URL pattern functionality is working correctly.")
    process.exit(0)
  } else {
    console.log("❌ Some tests failed. Please review the implementation.")
    process.exit(1)
  }
}

// Run the tests
runAllTests()
