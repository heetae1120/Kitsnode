import {redirect} from 'next/navigation';
import {SURVEY_HREF} from '@/components/public-categories';

export default function SurveyPage(){
 redirect(SURVEY_HREF);
}
