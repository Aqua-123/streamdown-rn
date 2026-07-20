import React from 'react';
import { render } from '@testing-library/react-native';
import { Streamdown } from '../../../../src/StreamdownRN';

describe('DOM-only prefix rejection', () => {
  // parity:420bb2ea7334825fa9fb596c0ef9ebcf7d3c4384858608667a0b863e04e0de34
  // parity:19ccd76aad8b9a2577acbdb90a587b47a51e96c0193b707c3dcad2b3957a7040
  // parity:87bf5747b8ea7ddc27145c7361eca32408570d0213834762c6cd20fad6b68941
  // parity:5dff43adcf460357bb5aad6fd256dca7d9257015261ed7c27244515536b75719
  // parity:f730d0d6cc24bedc62665a35726b0df60025d406a131118f3f6d06dd62476d97
  // parity:3e2b0d027e0187abcd95bd548c2a2cbaba39bfa9a49618b344c2ef2d9d61d44f
  // parity:f8f3f897e8fd84abccab7a5f2fb2b377250c73f557ac4ed6964ebfeff905aebf
  // parity:97a2f040207baa8364d7fc4d9bf6ebea0260e7e7011e39c7d03fe78916261568
  // parity:773c86cc003675d37e8fd27a84c52cdcc05f9492d97e8e136b9b54a958ebdfcb
  // parity:5169c2e4cf0a6f25fb3bdc75891bc1b03be36a22af865524e770aa2139804128
  // parity:b07439fc8bd83c29930a5ca499896ce26962d57b28eef8388822675d396aa3d3
  // parity:91a7c37bcee6b2d9c7d2900f1b06a51a6309afc4b44f2f0b9f19408e7263a2f6
  // parity:69890b28ea6436e34b2ad2bb0f9b868006db9dcbc1a5ad28ae1e4f9e446ccc03
  // parity:bd62f54e5cf5302052977af4f3738cbd11a3feb3ba20ea903381ba31d8e75c10
  // parity:0f08fbfaa6318ed37c87952086fb96c77c361ebbba5357767a9082459be70143
  // parity:8d164e53371009bf7ad3924130ca1be2d939f3f38e8003f28388183184417072
  // parity:97964854576b9842eb3f5e5cca6c6f820f197c343f68d2d0b692e3de51a4fb55
  it('rejects Tailwind prefix utilities instead of emulating CSS in React Native', () => {
    expect(() => render(React.createElement(Streamdown, {
      mode: 'static', children: 'text', prefix: 'tw',
    } as never))).toThrow(/prefix.*DOM-only.*React Native/i);
  });

  // parity:596e75db25ff29d715f0501ee5204bd46fa6168cc1d7e1b33b9bf0f328d27da8
  it('renders normally when no DOM prefix is supplied', () => {
    expect(render(React.createElement(Streamdown, {
      mode: 'static', children: '**bold**',
    })).getByText('bold')).toBeTruthy();
  });
});
