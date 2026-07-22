require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'StreamdownHermesEvidence'
  s.version        = package['version']
  s.summary        = 'Physical Release-Hermes trace instrumentation for Streamdown RN fixtures'
  s.description    = s.summary
  s.license        = { :type => 'Apache-2.0' }
  s.author         = 'FuturixAI'
  s.homepage       = 'https://github.com/Aqua-123/streamdown-rn'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
end
