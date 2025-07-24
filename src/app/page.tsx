import React from 'react';
import { getHtmlFileContent } from '../lib/readHtmlFile';

export default function HomePage() {
  const htmlContent = getHtmlFileContent();

  const updatedHtmlContent = htmlContent
    .replace(/https:\/\/forms\.gle\/thcitgxzF5yxFU18A/g, '/apply')
    .replace(/target="_blank"/g, ''); 

  return (
    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
  );
}
